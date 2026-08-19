<?php

namespace App\Services;

use App\Models\CmNotification;
use App\Models\User;
use App\Support\UserRoleHelper;

class CmNotificationService
{
    public static function notify(
        int $brandId,
        int $recipientUserId,
        string $type,
        string $title,
        ?string $body = null,
        ?array $data = null,
        ?string $relatedType = null,
        ?int $relatedId = null,
    ): CmNotification {
        return CmNotification::create([
            'brand_id' => $brandId,
            'recipient_user_id' => $recipientUserId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'related_type' => $relatedType,
            'related_id' => $relatedId,
        ]);
    }

    public static function notifySmm(int $brandId, string $type, string $title, ?string $body = null, ?array $data = null, ?string $relatedType = null, ?int $relatedId = null): void
    {
        $admins = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('slug', ['admin', 'smm', 'manager_operationnel']))
            ->get();

        foreach ($admins as $user) {
            self::notify($brandId, $user->id, $type, $title, $body, $data, $relatedType, $relatedId);
        }
    }

    // ─── Spec notification types ───

    public static function checklistSubmitted(int $brandId, int $cmUserId, int $checklistId, string $cmName): void
    {
        self::notifySmm(
            $brandId,
            'checklist_submitted',
            'Checklist soumise',
            "{$cmName} a soumis sa checklist pour validation.",
            ['checklist_id' => $checklistId, 'cm_user_id' => $cmUserId],
            'daily_checklist',
            $checklistId,
        );
    }

    public static function checklistValidated(int $brandId, int $cmUserId, int $checklistId, string $validatorName): void
    {
        self::notify(
            $brandId,
            $cmUserId,
            'checklist_validated',
            'Checklist validée',
            "{$validatorName} a validé votre checklist.",
            ['checklist_id' => $checklistId],
            'daily_checklist',
            $checklistId,
        );
    }

    public static function checklistRejected(int $brandId, int $cmUserId, int $checklistId, string $validatorName, string $reason): void
    {
        self::notify(
            $brandId,
            $cmUserId,
            'checklist_rejected',
            'Checklist rejetée',
            "{$validatorName} a rejeté votre checklist : {$reason}",
            ['checklist_id' => $checklistId, 'reason' => $reason],
            'daily_checklist',
            $checklistId,
        );
    }

    public static function checklistAutoClosedIncomplete(int $brandId, int $cmUserId, int $checklistId, float $completionRate): void
    {
        self::notify(
            $brandId,
            $cmUserId,
            'checklist_auto_closed',
            'Checklist clôturée automatiquement',
            "Votre checklist a été clôturée avec {$completionRate}% de complétion.",
            ['checklist_id' => $checklistId, 'completion_rate' => $completionRate],
            'daily_checklist',
            $checklistId,
        );
        self::notifySmm(
            $brandId,
            'checklist_auto_closed_alert',
            'Checklist CM incomplète',
            "La checklist du CM a été auto-clôturée à {$completionRate}%.",
            ['checklist_id' => $checklistId, 'cm_user_id' => $cmUserId, 'completion_rate' => $completionRate],
            'daily_checklist',
            $checklistId,
        );
    }

    public static function publicationDeadlineApproaching(int $brandId, int $cmUserId, int $contentId, string $title, string $deadline): void
    {
        self::notify(
            $brandId,
            $cmUserId,
            'publication_deadline',
            'Publication à venir',
            "La publication \"{$title}\" est prévue pour {$deadline}.",
            ['content_id' => $contentId],
            'content_calendar',
            $contentId,
        );
    }

    public static function signalEscalated(int $brandId, int $signalId, string $influencerName, string $signalType): void
    {
        self::notifySmm(
            $brandId,
            'signal_escalated',
            'Signalement escaladé',
            "Le signalement '{$signalType}' sur {$influencerName} a été escaladé automatiquement.",
            ['signal_id' => $signalId],
            'influencer_signal',
            $signalId,
        );
    }

    public static function moderationThresholdExceeded(int $brandId, int $cmUserId, string $cmName, int $count, string $period): void
    {
        self::notifySmm(
            $brandId,
            'moderation_threshold',
            'Seuil de modération dépassé',
            "{$cmName} a effectué {$count} actions de modération ce {$period}.",
            ['cm_user_id' => $cmUserId, 'count' => $count, 'period' => $period],
        );
    }

    public static function complaintCreatedFromCm(int $brandId, int $complaintId, string $reference, string $customerName): void
    {
        self::notifySmm(
            $brandId,
            'complaint_from_cm',
            'Nouvelle réclamation CM',
            "Réclamation {$reference} créée pour {$customerName}.",
            ['complaint_id' => $complaintId, 'reference' => $reference],
            'complaint',
            $complaintId,
        );
    }

    public static function complaintStatusChanged(int $brandId, int $cmUserId, int $complaintId, string $reference, string $newStatus): void
    {
        self::notify(
            $brandId,
            $cmUserId,
            'complaint_status_changed',
            'Réclamation mise à jour',
            "La réclamation {$reference} est passée au statut : {$newStatus}.",
            ['complaint_id' => $complaintId, 'status' => $newStatus],
            'complaint',
            $complaintId,
        );
    }

    public static function contentPublished(int $brandId, int $cmUserId, int $contentId, string $title): void
    {
        self::notifySmm(
            $brandId,
            'content_published_by_cm',
            'Publication confirmée',
            "Le CM a confirmé la publication de \"{$title}\".",
            ['content_id' => $contentId, 'cm_user_id' => $cmUserId],
            'content_calendar',
            $contentId,
        );
    }

    public static function contentNotPublished(int $brandId, int $cmUserId, int $contentId, string $title, string $reason): void
    {
        self::notifySmm(
            $brandId,
            'content_not_published',
            'Publication non effectuée',
            "Le CM n'a pas publié \"{$title}\" : {$reason}.",
            ['content_id' => $contentId, 'cm_user_id' => $cmUserId, 'reason' => $reason],
            'content_calendar',
            $contentId,
        );
    }
}
