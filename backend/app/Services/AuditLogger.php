<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    /**
     * Standard request-scoped audit entry.
     *
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    public static function log(Request $request, string $action, ?Model $entity = null, ?array $old = null, ?array $new = null): void
    {
        AuditLog::query()->create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'entity_type' => $entity ? $entity->getMorphClass() : null,
            'entity_id' => $entity?->getKey(),
            'old_values' => $old,
            'new_values' => $new,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 2000),
        ]);
    }

    /**
     * System-context audit entry — for actions that originate outside an
     * HTTP request (scheduled jobs, sync services, background workers).
     * user_id is null, ip_address is 'system', user_agent is 'system'.
     *
     * @param  array<string, mixed>|null  $data
     */
    public static function system(string $action, ?Model $entity = null, ?array $data = null): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => $action,
            'entity_type' => $entity ? $entity->getMorphClass() : null,
            'entity_id' => $entity?->getKey(),
            'old_values' => null,
            'new_values' => $data,
            'ip_address' => 'system',
            'user_agent' => 'system',
        ]);
    }
}
