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
        [$entityType, $entityId] = self::resolveEntity($action, $entity, $old, $new);

        AuditLog::query()->create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
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
        [$entityType, $entityId] = self::resolveEntity($action, $entity, null, $data);

        AuditLog::query()->create([
            'user_id' => null,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'old_values' => null,
            'new_values' => $data,
            'ip_address' => 'system',
            'user_agent' => 'system',
        ]);
    }

    /**
     * Derive entity_type/entity_id from the given model, or, when the
     * caller passed null (as most `delete` controllers do because the
     * model is gone by then), from the action prefix + old/new payloads.
     * This keeps "Objet concerné" populated in Historique d'activité
     * without needing 50+ callers to re-order their delete() vs log().
     */
    private static function resolveEntity(string $action, ?Model $entity, ?array $old, ?array $new): array
    {
        if ($entity) {
            return [$entity->getMorphClass(), $entity->getKey()];
        }
        $payload = $old ?? $new ?? [];
        $id = $payload['id'] ?? null;
        if ($id === null) return [null, null];

        $prefix = strtok($action, '.');
        $morph = self::ACTION_PREFIX_TO_MORPH[$prefix] ?? null;
        if (! $morph) return [null, null];
        return [$morph, $id];
    }

    /** Action prefix → Eloquent morph class, so a delete audit still says
     * "Produit · n° 42" even when the caller passed no model. */
    private const ACTION_PREFIX_TO_MORPH = [
        'products' => \App\Models\Product::class,
        'customers' => \App\Models\Customer::class,
        'orders' => \App\Models\Order::class,
        'order_events' => \App\Models\OrderEvent::class,
        'leads' => \App\Models\Lead::class,
        'lead_events' => \App\Models\LeadEvent::class,
        'shipments' => \App\Models\Shipment::class,
        'shipment_events' => \App\Models\ShipmentEvent::class,
        'delivery_payments' => \App\Models\DeliveryPayment::class,
        'delivery_companies' => \App\Models\DeliveryCompany::class,
        'ad_accounts' => \App\Models\AdAccount::class,
        'brands' => \App\Models\Brand::class,
        'stock' => \App\Models\StockMovement::class,
        'purchase_orders' => \App\Models\PurchaseOrder::class,
        'purchase_order_lines' => \App\Models\PurchaseOrderLine::class,
        'daily_kpis' => \App\Models\DailyKpi::class,
        'campaigns' => \App\Models\Campaign::class,
        'campaign_metrics' => \App\Models\CampaignMetric::class,
        'influencers' => \App\Models\Influencer::class,
        'suppliers' => \App\Models\Supplier::class,
        'social_accounts' => \App\Models\SocialAccount::class,
        'influencer_performance' => \App\Models\InfluencerPerformance::class,
        'influencer_collaborations' => \App\Models\InfluencerCollaboration::class,
        'strategies' => \App\Models\Strategy::class,
        'influencer_complaints' => \App\Models\InfluencerComplaint::class,
        'content_production' => \App\Models\ContentProduction::class,
        'content_calendar' => \App\Models\ContentCalendar::class,
        'cm_daily_tracking' => \App\Models\CmDailyTracking::class,
        'conversations' => \App\Models\Conversation::class,
        'messages' => \App\Models\Message::class,
        'influencer_messages' => \App\Models\InfluencerMessage::class,
        'automation_rules' => \App\Models\AutomationRule::class,
        'collab_projects' => \App\Models\CollabProject::class,
        'media_buying' => \App\Models\MediaBuyingEntry::class,
        'users' => \App\Models\User::class,
        'employees' => \App\Models\Employee::class,
        'accounting_accounts' => \App\Models\AccountingAccount::class,
        'accounting_entries' => \App\Models\AccountingEntry::class,
        'hr_career_events' => \App\Models\HrCareerEvent::class,
        'hr_leave_requests' => \App\Models\HrLeaveRequest::class,
        'hr_documents' => \App\Models\HrDocument::class,
        'hr_communications' => \App\Models\HrCommunication::class,
        'hr_evaluation_campaigns' => \App\Models\HrEvaluationCampaign::class,
        'hr_job_openings' => \App\Models\HrJobOpening::class,
        'influencer_documents' => \App\Models\InfluencerDocument::class,
        'influencer_shipments' => \App\Models\InfluencerShipment::class,
        'influencer_deliverables' => \App\Models\InfluencerDeliverable::class,
        'influencer_published_contents' => \App\Models\InfluencerPublishedContent::class,
        'client_invoices' => \App\Models\ClientInvoice::class,
        'knowledge_base' => \App\Models\BrandKnowledgeItem::class,
        'learning_path' => \App\Models\AcademyLearningPath::class,
        'academy_content' => \App\Models\AcademyContent::class,
    ];
}
