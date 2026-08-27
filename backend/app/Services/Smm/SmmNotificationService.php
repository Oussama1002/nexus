<?php

namespace App\Services\Smm;

use App\Models\CmNotification;
use App\Models\User;

/**
 * Thin wrapper around the shared CmNotification store for SMM-domain
 * automations (spec §11 RS-01 → RS-24). Reuses the same in-CRM inbox as
 * CM notifications so operators only have one bell to check.
 *
 * Recipient resolution uses role slugs from the spec:
 *  - notifySmm       → users with role 'smm' (or admin)
 *  - notifyManagerOps → users with role 'manager_operationnel' (or admin)
 *  - notifyDirection → users with role 'admin'
 *  - notifyBoth      → union of the two calls above (dedup by user id)
 */
class SmmNotificationService
{
    public static function notifySmm(?int $brandId, string $type, string $title, ?string $body = null, ?array $data = null, ?string $relatedType = null, ?int $relatedId = null): void
    {
        self::fanOut(['smm', 'admin'], $brandId, $type, $title, $body, $data, $relatedType, $relatedId);
    }

    public static function notifyManagerOps(?int $brandId, string $type, string $title, ?string $body = null, ?array $data = null, ?string $relatedType = null, ?int $relatedId = null): void
    {
        self::fanOut(['manager_operationnel', 'admin'], $brandId, $type, $title, $body, $data, $relatedType, $relatedId);
    }

    public static function notifyDirection(?int $brandId, string $type, string $title, ?string $body = null, ?array $data = null, ?string $relatedType = null, ?int $relatedId = null): void
    {
        self::fanOut(['admin'], $brandId, $type, $title, $body, $data, $relatedType, $relatedId);
    }

    public static function notifySmmAndOps(?int $brandId, string $type, string $title, ?string $body = null, ?array $data = null, ?string $relatedType = null, ?int $relatedId = null): void
    {
        self::fanOut(['smm', 'manager_operationnel', 'admin'], $brandId, $type, $title, $body, $data, $relatedType, $relatedId);
    }

    public static function notifyUser(int $userId, ?int $brandId, string $type, string $title, ?string $body = null, ?array $data = null, ?string $relatedType = null, ?int $relatedId = null): void
    {
        CmNotification::query()->create([
            'brand_id' => $brandId,
            'recipient_user_id' => $userId,
            'type' => 'smm_' . $type,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'related_type' => $relatedType,
            'related_id' => $relatedId,
        ]);
    }

    /**
     * @param array<int, string> $roleSlugs
     */
    private static function fanOut(array $roleSlugs, ?int $brandId, string $type, string $title, ?string $body, ?array $data, ?string $relatedType, ?int $relatedId): void
    {
        $users = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('slug', $roleSlugs))
            ->get();

        foreach ($users as $u) {
            CmNotification::query()->create([
                'brand_id' => $brandId,
                'recipient_user_id' => $u->id,
                'type' => 'smm_' . $type,
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
            ]);
        }
    }
}
