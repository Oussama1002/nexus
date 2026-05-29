<?php

namespace App\Services;

use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\EmployeeAttendanceRecord;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Throwable;

class AutomationEngineService
{
    /**
     * @param  array<string, mixed>  $eventPayload
     * @return array<int, array<string, mixed>>
     */
    public function runForEvent(int $brandId, string $triggerKey, array $eventPayload): array
    {
        $rules = AutomationRule::query()
            ->where('brand_id', $brandId)
            ->where('trigger_key', $triggerKey)
            ->where('is_active', true)
            ->orderByDesc('id')
            ->get();

        $results = [];
        foreach ($rules as $rule) {
            $results[] = $this->runRule($rule, $eventPayload);
        }

        return $results;
    }

    /**
     * @param  array<string, mixed>  $eventPayload
     * @return array<string, mixed>
     */
    public function testRule(AutomationRule $rule, array $eventPayload): array
    {
        return $this->runRule($rule, $eventPayload, true);
    }

    /**
     * @param  array<string, mixed>  $eventPayload
     * @return array<string, mixed>
     */
    private function runRule(AutomationRule $rule, array $eventPayload, bool $isTest = false): array
    {
        $context = $this->buildContext($rule, $eventPayload);
        $match = $this->matchesConditions((array) ($rule->condition_json ?? []), $context);
        if (! $match) {
            return $this->storeRun($rule, $eventPayload, $context, 'skipped', 'Conditions non remplies.', null, $isTest);
        }

        try {
            $result = $this->executeActions((array) ($rule->action_json ?? []), $context);

            return $this->storeRun($rule, $eventPayload, $context, 'executed', 'Automatisation executee.', $result, $isTest);
        } catch (Throwable $e) {
            return $this->storeRun(
                $rule,
                $eventPayload,
                $context,
                'failed',
                'Erreur execution: '.$e->getMessage(),
                ['exception' => $e->getMessage()],
                $isTest
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
    private function executeActions(array $actionJson, array $context): array
    {
        $sequence = Arr::get($actionJson, 'sequence');
        if (is_array($sequence) && count($sequence) > 0) {
            $steps = [];
            foreach ($sequence as $step) {
                if (! is_array($step)) {
                    continue;
                }
                $steps[] = $this->executeSingleAction($step, $context);
            }

            return ['mode' => 'sequence', 'steps' => $steps];
        }

        return ['mode' => 'single', 'step' => $this->executeSingleAction($actionJson, $context)];
    }

    /**
     * @param  array<string, mixed>  $action
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function executeSingleAction(array $action, array $context): array
    {
        $type = (string) ($action['type'] ?? 'log');
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

        return [
            'type' => $type,
            'rendered_message' => $rendered,
            'selected_variant' => $selectedVariant,
            'video_url' => $selectedVariant['video_url'] ?? ($action['video_url'] ?? null),
            'target' => $action['target'] ?? null,
        ];
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
                'brand_id' => $rule->brand_id,
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
