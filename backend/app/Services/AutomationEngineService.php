<?php

namespace App\Services;

use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\Employee;
use App\Models\EmployeeAttendanceRecord;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Throwable;

class AutomationEngineService
{
    public function __construct(
        private readonly WhatsAppCloudService $whatsApp,
    ) {}

    /**
     * @param  array<string, mixed>  $eventPayload
     * @return array<int, array<string, mixed>>
     */
    public function runForEvent(int $brandId, string $triggerKey, array $eventPayload): array
    {
        $rules = AutomationRule::query()
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->where('trigger_key', $triggerKey)
            ->where('is_active', true)
            ->orderByDesc('id')
            ->get();

        $results = [];
        foreach ($rules as $rule) {
            $results[] = $this->runRule($rule, $eventPayload, $brandId);
        }

        return $results;
    }

    /**
     * @param  array<string, mixed>  $eventPayload
     * @return array<string, mixed>
     */
    public function testRule(AutomationRule $rule, array $eventPayload): array
    {
        return $this->runRule($rule, $eventPayload, $rule->brand_id, true);
    }

    /**
     * @param  array<string, mixed>  $eventPayload
     * @return array<string, mixed>
     */
    private function runRule(AutomationRule $rule, array $eventPayload, ?int $brandId = null, bool $isTest = false): array
    {
        $context = $this->buildContext($rule, $eventPayload);
        $match = $this->matchesConditions((array) ($rule->condition_json ?? []), $context);
        if (! $match) {
            return $this->storeRun($rule, $eventPayload, $context, 'skipped', 'Conditions non remplies.', null, $isTest, $brandId);
        }

        try {
            $effectiveBrandId = $brandId ?? $rule->brand_id;
            $result = $this->executeActions((array) ($rule->action_json ?? []), $context, $effectiveBrandId, $isTest);

            return $this->storeRun($rule, $eventPayload, $context, 'executed', 'Automatisation exécutée.', $result, $isTest, $brandId);
        } catch (Throwable $e) {
            Log::error('automation.execution_failed', [
                'rule_id' => $rule->id,
                'error' => $e->getMessage(),
            ]);

            return $this->storeRun(
                $rule,
                $eventPayload,
                $context,
                'failed',
                'Erreur exécution: ' . $e->getMessage(),
                ['exception' => $e->getMessage()],
                $isTest,
                $brandId,
            );
        }
    }

    /**
     * @param  array<string, mixed>  $conditions
     * @param  array<string, mixed>  $context
     */
    private function matchesConditions(array $conditions, array $context): bool
    {
        if (! isset($conditions['all']) || ! is_array($conditions['all']) || count($conditions['all']) === 0) {
            return true;
        }

        foreach ($conditions['all'] as $cond) {
            if (! is_array($cond)) {
                return false;
            }
            $field = (string) ($cond['field'] ?? '');
            $op = (string) ($cond['op'] ?? 'eq');
            $expected = $cond['value'] ?? null;
            $actual = data_get($context, $field);
            if (! $this->compare($actual, $op, $expected)) {
                return false;
            }
        }

        return true;
    }

    private function compare(mixed $actual, string $op, mixed $expected): bool
    {
        return match ($op) {
            'eq' => $actual == $expected,
            'neq' => $actual != $expected,
            'gt' => (float) $actual > (float) $expected,
            'gte' => (float) $actual >= (float) $expected,
            'lt' => (float) $actual < (float) $expected,
            'lte' => (float) $actual <= (float) $expected,
            'contains' => str_contains(strtolower((string) $actual), strtolower((string) $expected)),
            default => false,
        };
    }

    /**
     * @param  array<string, mixed>  $actionJson
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function executeActions(array $actionJson, array $context, ?int $brandId, bool $isTest): array
    {
        $sequence = Arr::get($actionJson, 'sequence');
        if (is_array($sequence) && count($sequence) > 0) {
            $steps = [];
            foreach ($sequence as $step) {
                if (! is_array($step)) {
                    continue;
                }
                $steps[] = $this->executeSingleAction($step, $context, $brandId, $isTest);
            }

            return ['mode' => 'sequence', 'steps' => $steps];
        }

        return ['mode' => 'single', 'step' => $this->executeSingleAction($actionJson, $context, $brandId, $isTest)];
    }

    /**
     * @param  array<string, mixed>  $action
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function executeSingleAction(array $action, array $context, ?int $brandId, bool $isTest): array
    {
        $type = (string) ($action['type'] ?? 'log');
        $target = (string) ($action['target'] ?? '');
        $messageTemplate = (string) ($action['message'] ?? 'Automation triggered');
        $variants = is_array($action['variants'] ?? null) ? $action['variants'] : null;
        $selectedVariant = null;
        if ($variants && count($variants) > 0) {
            $selectedVariant = $this->pickVariant($variants);
            if (is_array($selectedVariant) && isset($selectedVariant['message'])) {
                $messageTemplate = (string) $selectedVariant['message'];
            }
        }

        $rendered = $this->renderTemplate($messageTemplate, $context);

        $sendResult = null;

        if (! $isTest && $brandId) {
            switch ($type) {
                case 'send_whatsapp':
                    $sendResult = $this->actionSendWhatsApp($target, $rendered, $context, $brandId);
                    break;
                case 'notify_admin':
                    $sendResult = $this->actionNotifyAdmins($rendered, $context, $brandId);
                    break;
            }
        }

        return [
            'type' => $type,
            'rendered_message' => $rendered,
            'selected_variant' => $selectedVariant,
            'video_url' => $selectedVariant['video_url'] ?? ($action['video_url'] ?? null),
            'target' => $target,
            'send_result' => $sendResult,
        ];
    }

    /**
     * Send WhatsApp message to the employee involved in the event.
     */
    private function actionSendWhatsApp(string $target, string $message, array $context, int $brandId): array
    {
        $phone = null;

        if ($target === 'employee' || $target === '') {
            $phone = data_get($context, 'employee.phone');
        } elseif (preg_match('/^\+?\d{8,15}$/', $target)) {
            $phone = $target;
        }

        if (! $phone || trim($phone) === '') {
            return ['status' => 'skipped', 'reason' => 'Numéro de téléphone non disponible.'];
        }

        try {
            $this->whatsApp->sendText($brandId, $phone, $message);

            return ['status' => 'sent', 'to' => $phone];
        } catch (Throwable $e) {
            Log::warning('automation.whatsapp_failed', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);

            return ['status' => 'failed', 'to' => $phone, 'error' => $e->getMessage()];
        }
    }

    /**
     * Send WhatsApp notification to all admin users of the brand.
     */
    private function actionNotifyAdmins(string $message, array $context, int $brandId): array
    {
        $admins = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('slug', ['admin', 'manager_operationnel']))
            ->get();

        $results = [];
        foreach ($admins as $admin) {
            $phone = $admin->phone ?? $admin->whatsapp_number ?? null;
            if (! $phone || trim($phone) === '') {
                $results[] = ['user' => $admin->name, 'status' => 'skipped', 'reason' => 'Pas de numéro.'];
                continue;
            }

            try {
                $employeeName = data_get($context, 'employee.full_name', 'Employé');
                $adminMessage = "🔔 Alerte automatisation\n\n{$message}\n\nEmployé: {$employeeName}";
                $this->whatsApp->sendText($brandId, $phone, $adminMessage);
                $results[] = ['user' => $admin->name, 'status' => 'sent', 'to' => $phone];
            } catch (Throwable $e) {
                $results[] = ['user' => $admin->name, 'status' => 'failed', 'error' => $e->getMessage()];
            }
        }

        return ['admin_notifications' => $results];
    }

    /**
     * @param  list<mixed>  $variants
     * @return array<string, mixed>|null
     */
    private function pickVariant(array $variants): ?array
    {
        $normalized = [];
        $total = 0;
        foreach ($variants as $variant) {
            if (! is_array($variant)) {
                continue;
            }
            $weight = max(1, (int) ($variant['weight'] ?? 1));
            $total += $weight;
            $normalized[] = ['payload' => $variant, 'weight' => $weight];
        }
        if ($total <= 0 || count($normalized) === 0) {
            return null;
        }
        $roll = random_int(1, $total);
        $acc = 0;
        foreach ($normalized as $row) {
            $acc += $row['weight'];
            if ($roll <= $acc) {
                return $row['payload'];
            }
        }

        return $normalized[array_key_last($normalized)]['payload'];
    }

    /**
     * @param  array<string, mixed>  $ruleContext
     */
    private function renderTemplate(string $template, array $ruleContext): string
    {
        return preg_replace_callback('/\{\{([\w\.\-_]+)\}\}/', function (array $m) use ($ruleContext) {
            return (string) data_get($ruleContext, trim((string) $m[1]), '');
        }, $template) ?? $template;
    }

    /**
     * @param  array<string, mixed>  $eventPayload
     * @return array<string, mixed>
     */
    private function buildContext(AutomationRule $rule, array $eventPayload): array
    {
        $context = ['event' => $eventPayload, 'metrics' => []];

        if ($rule->trigger_key === 'attendance.marked') {
            $employeeId = (int) data_get($eventPayload, 'employee_id', 0);
            $attendanceDate = data_get($eventPayload, 'attendance_date');

            if ($employeeId > 0) {
                $employee = Employee::query()->find($employeeId);
                if ($employee) {
                    $context['employee'] = [
                        'id' => $employee->id,
                        'full_name' => $employee->full_name,
                        'phone' => $employee->phone,
                    ];
                }
            }

            if ($employeeId > 0 && is_string($attendanceDate) && $attendanceDate !== '') {
                $day = Carbon::parse($attendanceDate);
                $startWeek = $day->copy()->startOfWeek();
                $endWeek = $day->copy()->endOfWeek();
                $lateCount = EmployeeAttendanceRecord::query()
                    ->where('employee_id', $employeeId)
                    ->whereBetween('attendance_date', [$startWeek->toDateString(), $endWeek->toDateString()])
                    ->where('status', 'late')
                    ->count();
                $context['metrics']['late_count_week'] = $lateCount;
            }
        }

        return $context;
    }

    /**
     * @param  array<string, mixed>  $eventPayload
     * @param  array<string, mixed>  $context
     * @param  array<string, mixed>|null  $resultPayload
     * @return array<string, mixed>
     */
    private function storeRun(
        AutomationRule $rule,
        array $eventPayload,
        array $context,
        string $status,
        string $message,
        ?array $resultPayload,
        bool $isTest,
        ?int $brandId = null,
    ): array {
        $payload = [
            'status' => $status,
            'message' => $message,
            'rule_id' => $rule->id,
            'rule_name' => $rule->name,
            'trigger_key' => $rule->trigger_key,
            'result_payload' => $resultPayload,
            'is_test' => $isTest,
        ];
        if (! $isTest) {
            AutomationRun::query()->create([
                'brand_id' => $brandId ?? $rule->brand_id,
                'automation_rule_id' => $rule->id,
                'trigger_key' => $rule->trigger_key,
                'event_payload_json' => $eventPayload,
                'context_payload_json' => $context,
                'result_payload_json' => $resultPayload,
                'status' => $status,
                'result_message' => $message,
            ]);
        }

        return $payload;
    }
}
