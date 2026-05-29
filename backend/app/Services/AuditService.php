<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Central audit entrypoint — delegates to AuditLogger for persistence.
 */
class AuditService
{
    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    public static function log(Request $request, string $action, ?Model $entity = null, ?array $oldValues = null, ?array $newValues = null): void
    {
        AuditLogger::log($request, $action, $entity, $oldValues, $newValues);
    }
}
