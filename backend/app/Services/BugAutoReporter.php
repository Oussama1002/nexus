<?php

namespace App\Services;

use App\Models\BugIncident;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Captures a Throwable into the bugs_incidents table. Same
 * exception class + message + top-of-trace hits an existing open row
 * and bumps its counter + last_seen_at instead of spamming.
 */
class BugAutoReporter
{
    /** Exception classes we don't want cluttering the tracker. */
    private const IGNORE = [
        \Illuminate\Auth\AuthenticationException::class,
        \Illuminate\Auth\Access\AuthorizationException::class,
        \Illuminate\Validation\ValidationException::class,
        \Illuminate\Session\TokenMismatchException::class,
        \Illuminate\Database\Eloquent\ModelNotFoundException::class,
        \Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class,
        \Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException::class,
        \Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException::class,
        \Symfony\Component\HttpKernel\Exception\HttpException::class,
    ];

    public static function shouldReport(Throwable $e): bool
    {
        foreach (self::IGNORE as $class) {
            if ($e instanceof $class) {
                // Still report 5xx HttpExceptions — they're server bugs, not client mistakes.
                if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpException
                    && $e->getStatusCode() >= 500) {
                    return true;
                }
                return false;
            }
        }
        return true;
    }

    /**
     * Record a runtime error. Safe to call from inside the exception
     * handler — swallows every internal failure so it never masks the
     * original exception.
     */
    public static function capture(Throwable $e, ?Request $request = null): void
    {
        if (! self::shouldReport($e)) return;
        try {
            self::doCapture($e, $request);
        } catch (Throwable) {
            // Never crash the response because reporting failed.
        }
    }

    /** Path used by the frontend error-boundary endpoint. */
    public static function captureClient(array $payload, ?Request $request = null): BugIncident
    {
        $title = mb_substr((string) ($payload['title'] ?? 'Erreur navigateur'), 0, 255);
        $description = (string) ($payload['message'] ?? '');
        $stack = (string) ($payload['stack'] ?? '');
        $fingerprint = hash('sha256', ($payload['fingerprint'] ?? $title . '|' . mb_substr($description, 0, 200)));

        return self::upsert([
            'title' => $title,
            'description' => $description,
            'trace' => $stack,
            'context' => array_merge((array) ($payload['context'] ?? []), [
                'source_kind' => 'browser',
                'url' => $payload['url'] ?? null,
                'user_agent' => $request?->userAgent(),
            ]),
            'severity' => self::severityForClient($payload),
            'module' => 'frontend',
            'fingerprint' => $fingerprint,
            'source' => 'runtime',
            'reporter_user_id' => $request?->user()?->id,
            'brand_id' => null,
        ]);
    }

    private static function doCapture(Throwable $e, ?Request $request): void
    {
        $class = get_class($e);
        $file = str_replace(base_path() . DIRECTORY_SEPARATOR, '', (string) $e->getFile());
        $line = $e->getLine();
        $msg = trim($e->getMessage()) ?: 'Erreur inconnue';

        // Fingerprint: exception class + top of file:line + first 200 chars of message.
        // Different messages of the same exception at the same location still merge,
        // which is what we want (e.g. "record 12 not found" and "record 13 not found").
        $normMsg = preg_replace('/\d+/', '#', mb_substr($msg, 0, 200));
        $fingerprint = hash('sha256', "{$class}|{$file}:{$line}|{$normMsg}");

        $title = mb_substr("{$class}: {$msg}", 0, 255);
        $trace = mb_substr((string) $e->getTraceAsString(), 0, 8000);

        self::upsert([
            'title' => $title,
            'description' => "{$class} at {$file}:{$line}\n\n{$msg}",
            'trace' => $trace,
            'context' => [
                'source_kind' => 'server',
                'url' => $request?->fullUrl(),
                'method' => $request?->method(),
                'ip' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
            ],
            'severity' => self::severityForServer($e),
            'module' => 'backend',
            'fingerprint' => $fingerprint,
            'source' => 'runtime',
            'reporter_user_id' => $request?->user()?->id,
            'brand_id' => null,
        ]);
    }

    private static function upsert(array $data): BugIncident
    {
        // If a non-closed bug with the same fingerprint exists, bump its
        // counter and last_seen_at. Otherwise create a new one.
        $existing = BugIncident::query()
            ->where('fingerprint', $data['fingerprint'])
            ->whereNotIn('status', ['closed'])
            ->first();

        if ($existing) {
            DB::table('bugs_incidents')->where('id', $existing->id)->update([
                'occurrences' => DB::raw('occurrences + 1'),
                'last_seen_at' => now(),
                // Bump severity if a higher-severity occurrence arrives.
                'severity' => self::higherSeverity($existing->severity, $data['severity']),
                'updated_at' => now(),
            ]);
            return $existing->fresh();
        }

        $data['status'] = 'open';
        $data['occurrences'] = 1;
        $data['last_seen_at'] = now();
        return BugIncident::query()->create($data);
    }

    private static function severityForServer(Throwable $e): string
    {
        // 5xx HTTP → major. Everything else default to major too — dev/QA
        // adjusts down if it's a nuisance.
        if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpException) {
            $code = $e->getStatusCode();
            if ($code >= 500) return 'major';
            return 'minor';
        }
        return 'major';
    }

    private static function severityForClient(array $payload): string
    {
        $sev = strtolower((string) ($payload['severity'] ?? 'minor'));
        return in_array($sev, ['critical', 'major', 'minor', 'cosmetic'], true) ? $sev : 'minor';
    }

    private static function higherSeverity(?string $current, string $incoming): string
    {
        $order = ['cosmetic' => 0, 'minor' => 1, 'major' => 2, 'critical' => 3];
        $c = $order[$current ?? 'minor'] ?? 1;
        $i = $order[$incoming] ?? 1;
        return $i > $c ? $incoming : ($current ?? $incoming);
    }
}
