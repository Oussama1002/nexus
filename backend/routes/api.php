<?php

use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AutomationRuleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\BrandKnowledgeItemController;
use App\Http\Controllers\Api\AdAccountController;
use App\Http\Controllers\Api\Academy\CourseController as AcademyCourseController;
use App\Http\Controllers\Api\Academy\SectionController as AcademySectionController;
use App\Http\Controllers\Api\Academy\LessonController as AcademyLessonController;
use App\Http\Controllers\Api\Academy\StudentController as AcademyStudentController;
use App\Http\Controllers\Api\Academy\EnrollmentController as AcademyEnrollmentController;
use App\Http\Controllers\Api\Academy\QuizController as AcademyQuizController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\Api\CampaignMetricController;
use App\Http\Controllers\Api\ClientContractController;
use App\Http\Controllers\Api\ClientPortalController;
use App\Http\Controllers\Api\ClientInvoiceController;
use App\Http\Controllers\Api\CollabDocumentController;
use App\Http\Controllers\Api\CollabKanbanController;
use App\Http\Controllers\Api\CollabProjectController;
use App\Http\Controllers\Api\ConfirmatriceWorkspaceController;
use App\Http\Controllers\Api\ChargeController;
use App\Http\Controllers\Api\CmDailyTrackingController;
use App\Http\Controllers\Api\CommunityManagerController;
use App\Http\Controllers\Api\ComplaintController;
use App\Http\Controllers\Api\ContentCalendarController;
use App\Http\Controllers\Api\ContentProductionController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DailyKpiController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeliveryCompanyController;
use App\Http\Controllers\Api\DeliveryDashboardController;
use App\Http\Controllers\Api\DeliveryPaymentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\FinanceSummaryController;
use App\Http\Controllers\Api\InfluencerCollaborationController;
use App\Http\Controllers\Api\InfluencerComplaintController;
use App\Http\Controllers\Api\InfluencerController;
use App\Http\Controllers\Api\InfluencerDeliverableController;
use App\Http\Controllers\Api\InfluencerDocumentController;
use App\Http\Controllers\Api\InfluencerMessageController;
use App\Http\Controllers\Api\InfluencerPaymentController;
use App\Http\Controllers\Api\InfluencerPerformanceController;
use App\Http\Controllers\Api\InfluencerPublishedContentController;
use App\Http\Controllers\Api\InfluencerShipmentController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\MetaAdsController;
use App\Http\Controllers\Api\MetaOAuthController;
use App\Http\Controllers\Api\MediaBuyingController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\ProcurementDashboardController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\PurchaseOrderLineController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\ShipmentEventController;
use App\Http\Controllers\Api\SocialAccountController;
use App\Http\Controllers\Api\SocialDirectoryController;
use App\Http\Controllers\Api\SocialPublicationController;
use App\Http\Controllers\Api\SocialInfluenceDashboardController;
use App\Http\Controllers\Api\StrategyController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\SettingsCenterController;
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\HrAttendanceController;
use App\Http\Controllers\Api\HrCandidateController;
use App\Http\Controllers\Api\HrCareerEventController;
use App\Http\Controllers\Api\HrCommunicationController;
use App\Http\Controllers\Api\HrDashboardController;
use App\Http\Controllers\Api\HrDisciplineRecordController;
use App\Http\Controllers\Api\HrDocumentController;
use App\Http\Controllers\Api\HrEvaluationCampaignController;
use App\Http\Controllers\Api\HrEvaluationController;
use App\Http\Controllers\Api\HrJobOpeningController;
use App\Http\Controllers\Api\HrLeaveRequestController;
use App\Http\Controllers\Api\HrOnboardingController;
use App\Http\Controllers\Api\HrPayrollBulletinController;
use App\Http\Controllers\Api\HrPayrollPeriodController;
use App\Http\Controllers\Api\HrTrainingRecordController;
use App\Http\Controllers\Api\SmmAutomationController;
use App\Http\Controllers\Api\SmmClientInsightController;
use App\Http\Controllers\Api\SmmContentController;
use App\Http\Controllers\Api\SmmDashboardController;
use App\Http\Controllers\Api\SmmEventController;
use App\Http\Controllers\Api\SmmExecutionCheckController;
use App\Http\Controllers\Api\SmmLearningController;
use App\Http\Controllers\Api\SmmMonthlyPlanController;
use App\Http\Controllers\Api\SmmMonthlyReportController;
use App\Http\Controllers\Api\SmmPerformanceController;
use App\Http\Controllers\Api\SmmStrategyController;
use App\Http\Controllers\Api\SmmVeilleController;
use App\Http\Controllers\Api\InternalChatController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WhatsAppController;
use App\Http\Controllers\Api\WhatsAppWebhookController;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => ApiResponse::success([
    'status' => 'ok',
    'service' => 'nexus-backend',
], 'Service healthy.'));

Route::post('auth/login', [AuthController::class, 'login']);

Route::get('webhooks/whatsapp', [WhatsAppWebhookController::class, 'verify']);
Route::post('webhooks/whatsapp', [WhatsAppWebhookController::class, 'receive']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);

    Route::put('profile', [AuthController::class, 'updateProfile']);
    Route::put('profile/password', [AuthController::class, 'updatePassword']);
    Route::post('profile/avatar', [AuthController::class, 'uploadAvatar']);

    Route::get('dashboard', [DashboardController::class, 'index'])
        ->middleware('permission:dashboard.view');
    Route::get('notifications', [DashboardController::class, 'notifications']);

    Route::get('confirmatrice-workspace/summary', [ConfirmatriceWorkspaceController::class, 'summary']);

    $registerCrud = function (string $path, string $controller, string $module): void {
        Route::get($path, [$controller, 'index'])->middleware("permission:{$module}.view");
        Route::post($path, [$controller, 'store'])->middleware("permission:{$module}.create");
        Route::get("{$path}/{id}", [$controller, 'show'])->whereNumber('id')->middleware("permission:{$module}.view");
        Route::put("{$path}/{id}", [$controller, 'update'])->whereNumber('id')->middleware("permission:{$module}.update");
        Route::patch("{$path}/{id}", [$controller, 'update'])->whereNumber('id')->middleware("permission:{$module}.update");
        Route::delete("{$path}/{id}", [$controller, 'destroy'])->whereNumber('id')->middleware("permission:{$module}.delete");
    };

    Route::get('users', [UserController::class, 'index'])->middleware('permission:users.view');
    Route::post('users', [UserController::class, 'store'])->middleware('permission:users.create');
    Route::get('users/{id}', [UserController::class, 'show'])->whereNumber('id')->middleware('permission:users.view');
    Route::put('users/{id}', [UserController::class, 'update'])->whereNumber('id')->middleware('permission:users.update');
    Route::patch('users/{id}', [UserController::class, 'update'])->whereNumber('id')->middleware('permission:users.update');
    Route::delete('users/{id}', [UserController::class, 'destroy'])->whereNumber('id')->middleware('permission:users.delete');
    Route::post('users/{id}/reset-password', [UserController::class, 'resetPassword'])->whereNumber('id')->middleware('permission:users.update');

    // Internal chat (between users)
    Route::get('internal-chat/threads', [InternalChatController::class, 'threads']);
    Route::get('internal-chat/unread', [InternalChatController::class, 'unreadCount']);
    Route::get('internal-chat/{userId}/messages', [InternalChatController::class, 'messages'])->whereNumber('userId');
    Route::post('internal-chat/{userId}/messages', [InternalChatController::class, 'send'])->whereNumber('userId');

    Route::get('roles', [RoleController::class, 'index'])->middleware('permission:roles.view');
    Route::get('roles/{id}', [RoleController::class, 'show'])->whereNumber('id')->middleware('permission:roles.view');
    Route::patch('roles/{id}', [RoleController::class, 'update'])->whereNumber('id')->middleware('permission:roles.update');

    Route::get('permissions', [PermissionController::class, 'index'])->middleware('permission:permissions.view');
    Route::get('permissions/{id}', [PermissionController::class, 'show'])->whereNumber('id')->middleware('permission:permissions.view');

    $registerCrud('brands', BrandController::class, 'brands');
    $registerCrud('customers', CustomerController::class, 'customers');

    Route::get('leads', [LeadController::class, 'index'])->middleware('permission:leads.view');
    Route::post('leads', [LeadController::class, 'store'])->middleware('permission:leads.create');
    Route::get('leads/{id}', [LeadController::class, 'show'])->whereNumber('id')->middleware('permission:leads.view');
    Route::put('leads/{id}', [LeadController::class, 'update'])->whereNumber('id')->middleware('permission:leads.update');
    Route::patch('leads/{id}', [LeadController::class, 'update'])->whereNumber('id')->middleware('permission:leads.update');
    Route::delete('leads/{id}', [LeadController::class, 'destroy'])->whereNumber('id')->middleware('permission:leads.delete');
    Route::post('leads/{id}/assign', [LeadController::class, 'assign'])->whereNumber('id')->middleware('permission:leads.update');
    Route::patch('leads/{id}/status', [LeadController::class, 'updateStatus'])->whereNumber('id')->middleware('permission:leads.update');
    Route::post('leads/{id}/convert-to-order', [LeadController::class, 'convertToOrder'])->whereNumber('id')->middleware('permission:leads.update');

    Route::get('conversations', [ConversationController::class, 'index'])->middleware('permission:conversations.view');
    Route::post('conversations', [ConversationController::class, 'store'])->middleware('permission:conversations.create');
    Route::get('conversations/{id}', [ConversationController::class, 'show'])->whereNumber('id')->middleware('permission:conversations.view');
    Route::put('conversations/{id}', [ConversationController::class, 'update'])->whereNumber('id')->middleware('permission:conversations.update');
    Route::patch('conversations/{id}', [ConversationController::class, 'update'])->whereNumber('id')->middleware('permission:conversations.update');
    Route::delete('conversations/{conversationId}/messages/{messageId}', [ConversationController::class, 'destroyMessage'])->whereNumber('conversationId')->whereNumber('messageId')->middleware('permission:conversations.delete');
    Route::delete('conversations/{id}', [ConversationController::class, 'destroy'])->whereNumber('id')->middleware('permission:conversations.delete');
    Route::get('conversations/{id}/messages', [ConversationController::class, 'messages'])->whereNumber('id')->middleware('permission:conversations.view');
    Route::post('conversations/{id}/messages', [ConversationController::class, 'storeMessage'])->whereNumber('id')->middleware('permission:conversations.create');
    Route::post('conversations/{id}/upload', [ConversationController::class, 'uploadAttachment'])->whereNumber('id')->middleware('permission:conversations.create');
    Route::post('conversations/{id}/send-template', [ConversationController::class, 'sendTemplate'])->whereNumber('id')->middleware('permission:conversations.create');

    Route::get('orders', [OrderController::class, 'index'])->middleware('permission:orders.view');
    Route::post('orders', [OrderController::class, 'store'])->middleware('permission:orders.create');
    Route::get('orders/{id}', [OrderController::class, 'show'])->whereNumber('id')->middleware('permission:orders.view');
    Route::put('orders/{id}', [OrderController::class, 'update'])->whereNumber('id')->middleware('permission:orders.update');
    Route::patch('orders/{id}', [OrderController::class, 'update'])->whereNumber('id')->middleware('permission:orders.update');
    Route::delete('orders/{id}', [OrderController::class, 'destroy'])->whereNumber('id')->middleware('permission:orders.delete');
    Route::patch('orders/{id}/status', [OrderController::class, 'updateStatus'])->whereNumber('id')->middleware('permission:orders.update');

    $registerCrud('products', ProductController::class, 'products');

    Route::get('stock-movements', [StockMovementController::class, 'index'])->middleware('permission:stock.view');
    Route::post('stock-movements', [StockMovementController::class, 'store'])->middleware('permission:stock.create');
    Route::get('stock-movements/{id}', [StockMovementController::class, 'show'])->whereNumber('id')->middleware('permission:stock.view');

    $registerCrud('suppliers', SupplierController::class, 'suppliers');
    $registerCrud('knowledge-base', BrandKnowledgeItemController::class, 'knowledge_base');

    Route::get('dashboards/procurement', [ProcurementDashboardController::class, 'summary'])->middleware('permission:purchase_orders.view');

    Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->middleware('permission:purchase_orders.view');
    Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->middleware('permission:purchase_orders.create');
    Route::post('purchase-orders/{id}/receive', [PurchaseOrderController::class, 'receive'])->whereNumber('id')->middleware('permission:purchase_orders.receive');
    Route::post('purchase-orders/{id}/send-supplier', [PurchaseOrderController::class, 'sendToSupplier'])->whereNumber('id')->middleware('permission:purchase_orders.update');
    Route::post('purchase-orders/{id}/cancel', [PurchaseOrderController::class, 'cancel'])->whereNumber('id')->middleware('permission:purchase_orders.update');
    Route::get('purchase-orders/{id}', [PurchaseOrderController::class, 'show'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    Route::put('purchase-orders/{id}', [PurchaseOrderController::class, 'update'])->whereNumber('id')->middleware('permission:purchase_orders.update');
    Route::patch('purchase-orders/{id}', [PurchaseOrderController::class, 'update'])->whereNumber('id')->middleware('permission:purchase_orders.update');
    Route::delete('purchase-orders/{id}', [PurchaseOrderController::class, 'destroy'])->whereNumber('id')->middleware('permission:purchase_orders.delete');

    Route::get('purchase-order-lines', [PurchaseOrderLineController::class, 'index'])->middleware('permission:purchase_orders.view');
    Route::post('purchase-order-lines', [PurchaseOrderLineController::class, 'store'])->middleware('permission:purchase_orders.update');
    Route::get('purchase-order-lines/{id}', [PurchaseOrderLineController::class, 'show'])->whereNumber('id')->middleware('permission:purchase_orders.view');
    Route::put('purchase-order-lines/{id}', [PurchaseOrderLineController::class, 'update'])->whereNumber('id')->middleware('permission:purchase_orders.update');
    Route::patch('purchase-order-lines/{id}', [PurchaseOrderLineController::class, 'update'])->whereNumber('id')->middleware('permission:purchase_orders.update');
    Route::delete('purchase-order-lines/{id}', [PurchaseOrderLineController::class, 'destroy'])->whereNumber('id')->middleware('permission:purchase_orders.update');

    Route::get('shipments', [ShipmentController::class, 'index'])->middleware('permission:shipments.view');
    Route::get('shipments/cities', [ShipmentController::class, 'cities'])->middleware('permission:shipments.view');
    Route::post('shipments', [ShipmentController::class, 'store'])->middleware('permission:shipments.create');
    Route::patch('shipments/{id}/status', [ShipmentController::class, 'patchStatus'])->whereNumber('id')->middleware('permission:shipments.status');
    Route::post('shipments/{id}/sync', [ShipmentController::class, 'sync'])->whereNumber('id')->middleware('permission:shipments.sync');
    Route::post('shipments/{id}/dispatch', [ShipmentController::class, 'dispatch'])->whereNumber('id')->middleware('permission:shipments.create');
    Route::post('shipments/{id}/cancel', [ShipmentController::class, 'cancel'])->whereNumber('id')->middleware('permission:shipments.update');
    Route::get('shipments/{id}/label', [ShipmentController::class, 'label'])->whereNumber('id')->middleware('permission:shipments.label');
    Route::get('shipments/{id}/events', [ShipmentEventController::class, 'indexForShipment'])->whereNumber('id')->middleware('permission:shipments.view');
    Route::post('shipments/{id}/events', [ShipmentEventController::class, 'storeForShipment'])->whereNumber('id')->middleware('permission:shipments.create');
    Route::get('shipments/{id}', [ShipmentController::class, 'show'])->whereNumber('id')->middleware('permission:shipments.view');
    Route::put('shipments/{id}', [ShipmentController::class, 'update'])->whereNumber('id')->middleware('permission:shipments.update');
    Route::patch('shipments/{id}', [ShipmentController::class, 'update'])->whereNumber('id')->middleware('permission:shipments.update');
    Route::delete('shipments/{id}', [ShipmentController::class, 'destroy'])->whereNumber('id')->middleware('permission:shipments.delete');

    Route::get('shipment-events', [ShipmentEventController::class, 'index'])->middleware('permission:shipments.view');
    Route::post('shipment-events', [ShipmentEventController::class, 'store'])->middleware('permission:shipments.create');
    Route::get('shipment-events/{id}', [ShipmentEventController::class, 'show'])->whereNumber('id')->middleware('permission:shipments.view');
    Route::delete('shipment-events/{id}', [ShipmentEventController::class, 'destroy'])->whereNumber('id')->middleware('permission:shipments.delete');

    $registerCrud('delivery-companies', DeliveryCompanyController::class, 'delivery_companies');

    Route::get('delivery/dashboard', DeliveryDashboardController::class)->middleware('permission:delivery.dashboard');
    Route::post('delivery/sendit/sync', [DeliveryDashboardController::class, 'syncSendit'])->middleware('permission:delivery.dashboard');
    Route::post('delivery/ameex/sync', [DeliveryDashboardController::class, 'syncAmeex'])->middleware('permission:delivery.dashboard');

    Route::get('delivery-payments', [DeliveryPaymentController::class, 'index'])->middleware('permission:delivery_payments.view');
    Route::get('delivery-payments/cod-summary', [DeliveryPaymentController::class, 'codPendingSummary'])->middleware('permission:delivery_payments.view');
    Route::post('delivery-payments', [DeliveryPaymentController::class, 'store'])->middleware('permission:delivery_payments.create');
    Route::get('delivery-payments/{id}', [DeliveryPaymentController::class, 'show'])->whereNumber('id')->middleware('permission:delivery_payments.view');
    Route::put('delivery-payments/{id}', [DeliveryPaymentController::class, 'update'])->whereNumber('id')->middleware('permission:delivery_payments.update');
    Route::patch('delivery-payments/{id}', [DeliveryPaymentController::class, 'update'])->whereNumber('id')->middleware('permission:delivery_payments.update');
    Route::post('delivery-payments/{id}/reconcile', [DeliveryPaymentController::class, 'reconcile'])->whereNumber('id')->middleware('permission:delivery_payments.reconcile');
    Route::patch('delivery-payments/{id}/reconcile', [DeliveryPaymentController::class, 'reconcile'])->whereNumber('id')->middleware('permission:delivery_payments.reconcile');
    Route::delete('delivery-payments/{id}', [DeliveryPaymentController::class, 'destroy'])->whereNumber('id')->middleware('permission:delivery_payments.delete');
    Route::get('ad-accounts', [AdAccountController::class, 'index'])->middleware('permission:ad_accounts.view');
    Route::post('ad-accounts', [AdAccountController::class, 'store'])->middleware('permission:ad_accounts.create');
    Route::get('ad-accounts/{id}', [AdAccountController::class, 'show'])->whereNumber('id')->middleware('permission:ad_accounts.view');
    Route::put('ad-accounts/{id}', [AdAccountController::class, 'update'])->whereNumber('id')->middleware('permission:ad_accounts.update');
    Route::patch('ad-accounts/{id}', [AdAccountController::class, 'update'])->whereNumber('id')->middleware('permission:ad_accounts.update');
    Route::delete('ad-accounts/{id}', [AdAccountController::class, 'destroy'])->whereNumber('id')->middleware('permission:ad_accounts.delete');

    Route::prefix('meta')->group(function () {
        Route::get('oauth/url', [MetaOAuthController::class, 'redirectUrl']);
        Route::get('ad-accounts', [MetaAdsController::class, 'previewAdAccounts'])->middleware('permission:ad_accounts.view');
        Route::post('sync/ad-accounts', [MetaAdsController::class, 'syncAdAccounts'])->middleware('permission:ad_accounts.update');
        Route::post('sync/campaigns', [MetaAdsController::class, 'syncCampaigns'])->middleware('permission:campaigns.update');
        Route::post('sync/insights', [MetaAdsController::class, 'syncInsights'])->middleware('permission:campaign_metrics.create');
    });

    Route::get('campaigns', [CampaignController::class, 'index'])->middleware('permission:campaigns.view');
    Route::post('campaigns', [CampaignController::class, 'store'])->middleware('permission:campaigns.create');
    Route::get('campaigns/{id}', [CampaignController::class, 'show'])->whereNumber('id')->middleware('permission:campaigns.view');
    Route::put('campaigns/{id}', [CampaignController::class, 'update'])->whereNumber('id')->middleware('permission:campaigns.update');
    Route::patch('campaigns/{id}', [CampaignController::class, 'update'])->whereNumber('id')->middleware('permission:campaigns.update');
    Route::delete('campaigns/{id}', [CampaignController::class, 'destroy'])->whereNumber('id')->middleware('permission:campaigns.delete');

    Route::get('campaign-metrics', [CampaignMetricController::class, 'index'])->middleware('permission:campaign_metrics.view');
    Route::post('campaign-metrics', [CampaignMetricController::class, 'store'])->middleware('permission:campaign_metrics.create');
    Route::get('campaign-metrics/{id}', [CampaignMetricController::class, 'show'])->whereNumber('id')->middleware('permission:campaign_metrics.view');
    Route::put('campaign-metrics/{id}', [CampaignMetricController::class, 'update'])->whereNumber('id')->middleware('permission:campaign_metrics.update');
    Route::patch('campaign-metrics/{id}', [CampaignMetricController::class, 'update'])->whereNumber('id')->middleware('permission:campaign_metrics.update');
    Route::delete('campaign-metrics/{id}', [CampaignMetricController::class, 'destroy'])->whereNumber('id')->middleware('permission:campaign_metrics.delete');
    Route::post('media-buying/{id}/repurpose', [MediaBuyingController::class, 'repurpose'])->whereNumber('id')->middleware('permission:campaigns.create');
    Route::get('media-buying', [MediaBuyingController::class, 'index'])->middleware('permission:campaigns.view');
    Route::post('media-buying', [MediaBuyingController::class, 'store'])->middleware('permission:campaigns.create');
    Route::get('media-buying/{id}', [MediaBuyingController::class, 'show'])->whereNumber('id')->middleware('permission:campaigns.view');
    Route::put('media-buying/{id}', [MediaBuyingController::class, 'update'])->whereNumber('id')->middleware('permission:campaigns.update');
    Route::patch('media-buying/{id}', [MediaBuyingController::class, 'update'])->whereNumber('id')->middleware('permission:campaigns.update');
    Route::delete('media-buying/{id}', [MediaBuyingController::class, 'destroy'])->whereNumber('id')->middleware('permission:campaigns.delete');
    Route::get('collab-projects', [CollabProjectController::class, 'index'])->middleware('permission:collab_projects.view');
    Route::post('collab-projects', [CollabProjectController::class, 'store'])->middleware('permission:collab_projects.create');
    Route::get('collab-projects/{id}', [CollabProjectController::class, 'show'])->whereNumber('id')->middleware('permission:collab_projects.view');
    Route::put('collab-projects/{id}', [CollabProjectController::class, 'update'])->whereNumber('id')->middleware('permission:collab_projects.update');
    Route::patch('collab-projects/{id}', [CollabProjectController::class, 'update'])->whereNumber('id')->middleware('permission:collab_projects.update');
    Route::delete('collab-projects/{id}', [CollabProjectController::class, 'destroy'])->whereNumber('id')->middleware('permission:collab_projects.delete');
    Route::post('collab-projects/{id}/members', [CollabProjectController::class, 'addMember'])->whereNumber('id')->middleware('permission:collab_projects.update');
    Route::delete('collab-projects/{id}/members/{memberId}', [CollabProjectController::class, 'removeMember'])->whereNumber('id')->whereNumber('memberId')->middleware('permission:collab_projects.update');

    // Kanban board for collab projects
    Route::get('collab-projects/{projectId}/board', [CollabKanbanController::class, 'board'])->whereNumber('projectId')->middleware('permission:collab_projects.view');
    Route::post('collab-projects/{projectId}/columns', [CollabKanbanController::class, 'storeColumn'])->whereNumber('projectId')->middleware('permission:collab_projects.update');
    Route::put('collab-projects/{projectId}/columns/{columnId}', [CollabKanbanController::class, 'updateColumn'])->whereNumber('projectId')->whereNumber('columnId')->middleware('permission:collab_projects.update');
    Route::delete('collab-projects/{projectId}/columns/{columnId}', [CollabKanbanController::class, 'destroyColumn'])->whereNumber('projectId')->whereNumber('columnId')->middleware('permission:collab_projects.update');
    Route::post('collab-projects/{projectId}/columns/reorder', [CollabKanbanController::class, 'reorderColumns'])->whereNumber('projectId')->middleware('permission:collab_projects.update');
    Route::post('collab-projects/{projectId}/tasks', [CollabKanbanController::class, 'storeTask'])->whereNumber('projectId')->middleware('permission:collab_projects.update');
    Route::put('collab-projects/{projectId}/tasks/{taskId}', [CollabKanbanController::class, 'updateTask'])->whereNumber('projectId')->whereNumber('taskId')->middleware('permission:collab_projects.update');
    Route::delete('collab-projects/{projectId}/tasks/{taskId}', [CollabKanbanController::class, 'destroyTask'])->whereNumber('projectId')->whereNumber('taskId')->middleware('permission:collab_projects.update');
    Route::post('collab-projects/{projectId}/tasks/{taskId}/move', [CollabKanbanController::class, 'moveTask'])->whereNumber('projectId')->whereNumber('taskId')->middleware('permission:collab_projects.update');

    Route::get('collab-projects/{projectId}/documents', [CollabDocumentController::class, 'index'])->whereNumber('projectId')->middleware('permission:collab_projects.view');
    Route::post('collab-projects/{projectId}/documents', [CollabDocumentController::class, 'store'])->whereNumber('projectId')->middleware('permission:collab_projects.update');
    Route::get('collab-projects/{projectId}/documents/{docId}/download', [CollabDocumentController::class, 'download'])->whereNumber('projectId')->whereNumber('docId')->middleware('permission:collab_projects.view');
    Route::delete('collab-projects/{projectId}/documents/{docId}', [CollabDocumentController::class, 'destroy'])->whereNumber('projectId')->whereNumber('docId')->middleware('permission:collab_projects.update');

    Route::get('directory/social-users', [SocialDirectoryController::class, 'users'])->middleware('permission:social_accounts.view');

    Route::get('social-accounts', [SocialAccountController::class, 'index'])->middleware('permission:social_accounts.view');
    Route::post('social-accounts', [SocialAccountController::class, 'store'])->middleware('permission:social_accounts.create');
    Route::get('social-accounts/{id}', [SocialAccountController::class, 'show'])->whereNumber('id')->middleware('permission:social_accounts.view');
    Route::put('social-accounts/{id}', [SocialAccountController::class, 'update'])->whereNumber('id')->middleware('permission:social_accounts.update');
    Route::patch('social-accounts/{id}', [SocialAccountController::class, 'update'])->whereNumber('id')->middleware('permission:social_accounts.update');
    Route::delete('social-accounts/{id}', [SocialAccountController::class, 'destroy'])->whereNumber('id')->middleware('permission:social_accounts.delete');

    Route::get('social-publications', [SocialPublicationController::class, 'index'])->middleware('permission:social_publications.view');
    Route::post('social-publications', [SocialPublicationController::class, 'store'])->middleware('permission:social_publications.create');
    Route::get('social-publications/{id}', [SocialPublicationController::class, 'show'])->whereNumber('id')->middleware('permission:social_publications.view');
    Route::put('social-publications/{id}', [SocialPublicationController::class, 'update'])->whereNumber('id')->middleware('permission:social_publications.update');
    Route::patch('social-publications/{id}', [SocialPublicationController::class, 'update'])->whereNumber('id')->middleware('permission:social_publications.update');
    Route::delete('social-publications/{id}', [SocialPublicationController::class, 'destroy'])->whereNumber('id')->middleware('permission:social_publications.delete');

    Route::get('strategies', [StrategyController::class, 'index'])->middleware('permission:strategies.view');
    Route::post('strategies/upload-document', [StrategyController::class, 'uploadDocument']);
    Route::post('strategies', [StrategyController::class, 'store'])->middleware('permission:strategies.create');
    Route::get('strategies/{id}', [StrategyController::class, 'show'])->whereNumber('id')->middleware('permission:strategies.view');
    Route::put('strategies/{id}', [StrategyController::class, 'update'])->whereNumber('id')->middleware('permission:strategies.update');
    Route::patch('strategies/{id}', [StrategyController::class, 'update'])->whereNumber('id')->middleware('permission:strategies.update');
    Route::delete('strategies/{id}', [StrategyController::class, 'destroy'])->whereNumber('id')->middleware('permission:strategies.delete');
    Route::post('strategies/{id}/approve', [StrategyController::class, 'approve'])->whereNumber('id')->middleware('permission:strategies.approve');

    Route::get('content-calendar', [ContentCalendarController::class, 'index'])->middleware('permission:content_calendar.view');
    Route::post('content-calendar', [ContentCalendarController::class, 'store'])->middleware('permission:content_calendar.create');
    Route::get('content-calendar/{id}', [ContentCalendarController::class, 'show'])->whereNumber('id')->middleware('permission:content_calendar.view');
    Route::put('content-calendar/{id}', [ContentCalendarController::class, 'update'])->whereNumber('id')->middleware('permission:content_calendar.update');
    Route::patch('content-calendar/{id}', [ContentCalendarController::class, 'update'])->whereNumber('id')->middleware('permission:content_calendar.update');
    Route::delete('content-calendar/{id}', [ContentCalendarController::class, 'destroy'])->whereNumber('id')->middleware('permission:content_calendar.delete');
    Route::post('content-calendar/{id}/submit-review', [ContentCalendarController::class, 'submitForReview'])->whereNumber('id')->middleware('permission:content_calendar.update');
    Route::post('content-calendar/{id}/approve', [ContentCalendarController::class, 'approveContent'])->whereNumber('id')->middleware('permission:content_calendar.approve');
    Route::post('content-calendar/{id}/request-revision', [ContentCalendarController::class, 'requestRevision'])->whereNumber('id')->middleware('permission:content_calendar.approve');
    Route::post('content-calendar/{id}/reject', [ContentCalendarController::class, 'rejectContent'])->whereNumber('id')->middleware('permission:content_calendar.approve');
    Route::post('content-calendar/{id}/mark-published', [ContentCalendarController::class, 'markPublished'])->whereNumber('id')->middleware('permission:content_calendar.update');
    Route::post('content-calendar/{id}/mark-not-published', [ContentCalendarController::class, 'markNotPublished'])->whereNumber('id')->middleware('permission:content_calendar.update');

    Route::get('content-production', [ContentProductionController::class, 'index'])->middleware('permission:content_production.view');
    Route::post('content-production', [ContentProductionController::class, 'store'])->middleware('permission:content_production.create');
    Route::get('content-production/{id}', [ContentProductionController::class, 'show'])->whereNumber('id')->middleware('permission:content_production.view');
    Route::put('content-production/{id}', [ContentProductionController::class, 'update'])->whereNumber('id')->middleware('permission:content_production.update');
    Route::patch('content-production/{id}', [ContentProductionController::class, 'update'])->whereNumber('id')->middleware('permission:content_production.update');
    Route::delete('content-production/{id}', [ContentProductionController::class, 'destroy'])->whereNumber('id')->middleware('permission:content_production.delete');

    Route::get('cm-daily-tracking', [CmDailyTrackingController::class, 'index'])->middleware('permission:cm_tracking.view');
    Route::post('cm-daily-tracking', [CmDailyTrackingController::class, 'store'])->middleware('permission:cm_tracking.create');
    Route::get('cm-daily-tracking/{id}', [CmDailyTrackingController::class, 'show'])->whereNumber('id')->middleware('permission:cm_tracking.view');
    Route::put('cm-daily-tracking/{id}', [CmDailyTrackingController::class, 'update'])->whereNumber('id')->middleware('permission:cm_tracking.update');
    Route::patch('cm-daily-tracking/{id}', [CmDailyTrackingController::class, 'update'])->whereNumber('id')->middleware('permission:cm_tracking.update');
    Route::delete('cm-daily-tracking/{id}', [CmDailyTrackingController::class, 'destroy'])->whereNumber('id')->middleware('permission:cm_tracking.delete');

    Route::get('dashboards/social', [SocialInfluenceDashboardController::class, 'social'])->middleware('permission:social_accounts.view');
    Route::get('dashboards/influence', [SocialInfluenceDashboardController::class, 'influence'])->middleware('permission:influence.view');

    // ─── Influencers ───
    Route::get('influencers', [InfluencerController::class, 'index'])->middleware('permission:influence.view');
    Route::post('influencers', [InfluencerController::class, 'store'])->middleware('permission:influence.create');
    Route::get('influencers/{id}', [InfluencerController::class, 'show'])->whereNumber('id')->middleware('permission:influence.view');
    Route::put('influencers/{id}', [InfluencerController::class, 'update'])->whereNumber('id')->middleware('permission:influence.update');
    Route::patch('influencers/{id}', [InfluencerController::class, 'update'])->whereNumber('id')->middleware('permission:influence.update');
    Route::post('influencers/{id}/qualify', [InfluencerController::class, 'qualify'])->whereNumber('id')->middleware('permission:influence.manage');
    Route::post('influencers/{id}/exclude', [InfluencerController::class, 'exclude'])->whereNumber('id')->middleware('permission:influence.manage');
    Route::post('influencers/{id}/status', [InfluencerController::class, 'updateStatus'])->whereNumber('id')->middleware('permission:influence.update');
    Route::delete('influencers/{id}', [InfluencerController::class, 'destroy'])->whereNumber('id')->middleware('permission:influence.delete');

    // ─── Influencer Collaborations ───
    Route::get('influencer-collaborations', [InfluencerCollaborationController::class, 'index'])->middleware('permission:influencer_collaborations.view');
    Route::post('influencer-collaborations', [InfluencerCollaborationController::class, 'store'])->middleware('permission:influencer_collaborations.create');
    Route::get('influencer-collaborations/{id}', [InfluencerCollaborationController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_collaborations.view');
    Route::put('influencer-collaborations/{id}', [InfluencerCollaborationController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_collaborations.update');
    Route::patch('influencer-collaborations/{id}', [InfluencerCollaborationController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_collaborations.update');
    Route::post('influencer-collaborations/{id}/status', [InfluencerCollaborationController::class, 'updateStatus'])->whereNumber('id')->middleware('permission:influencer_collaborations.update');
    Route::post('influencer-collaborations/{id}/request-validation', [InfluencerCollaborationController::class, 'requestValidation'])->whereNumber('id')->middleware('permission:influencer_collaborations.update');
    Route::post('influencer-collaborations/{id}/decide-validation', [InfluencerCollaborationController::class, 'decideValidation'])->whereNumber('id')->middleware('permission:influencer_collaborations.validate');
    Route::post('influencer-collaborations/{id}/submit-review', [InfluencerCollaborationController::class, 'submitReview'])->whereNumber('id')->middleware('permission:influencer_collaborations.update');
    Route::delete('influencer-collaborations/{id}', [InfluencerCollaborationController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_collaborations.delete');

    // ─── Influencer Deliverables ───
    Route::get('influencer-deliverables', [InfluencerDeliverableController::class, 'index'])->middleware('permission:influencer_deliverables.view');
    Route::post('influencer-deliverables', [InfluencerDeliverableController::class, 'store'])->middleware('permission:influencer_deliverables.create');
    Route::get('influencer-deliverables/{id}', [InfluencerDeliverableController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_deliverables.view');
    Route::put('influencer-deliverables/{id}', [InfluencerDeliverableController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_deliverables.update');
    Route::patch('influencer-deliverables/{id}', [InfluencerDeliverableController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_deliverables.update');
    Route::delete('influencer-deliverables/{id}', [InfluencerDeliverableController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_deliverables.delete');

    // ─── Influencer Published Contents ───
    Route::get('influencer-published-contents', [InfluencerPublishedContentController::class, 'index'])->middleware('permission:influencer_deliverables.view');
    Route::post('influencer-published-contents', [InfluencerPublishedContentController::class, 'store'])->middleware('permission:influencer_deliverables.create');
    Route::get('influencer-published-contents/{id}', [InfluencerPublishedContentController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_deliverables.view');
    Route::put('influencer-published-contents/{id}', [InfluencerPublishedContentController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_deliverables.update');
    Route::patch('influencer-published-contents/{id}', [InfluencerPublishedContentController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_deliverables.update');
    Route::delete('influencer-published-contents/{id}', [InfluencerPublishedContentController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_deliverables.delete');

    // ─── Influencer Shipments ───
    Route::get('influencer-shipments', [InfluencerShipmentController::class, 'index'])->middleware('permission:influencer_shipments.view');
    Route::post('influencer-shipments', [InfluencerShipmentController::class, 'store'])->middleware('permission:influencer_shipments.create');
    Route::get('influencer-shipments/{id}', [InfluencerShipmentController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_shipments.view');
    Route::put('influencer-shipments/{id}', [InfluencerShipmentController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_shipments.update');
    Route::patch('influencer-shipments/{id}', [InfluencerShipmentController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_shipments.update');
    Route::delete('influencer-shipments/{id}', [InfluencerShipmentController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_shipments.delete');

    // ─── Influencer Payments ───
    Route::get('influencer-payments', [InfluencerPaymentController::class, 'index'])->middleware('permission:influencer_payments.view');
    Route::post('influencer-payments', [InfluencerPaymentController::class, 'store'])->middleware('permission:influencer_payments.create');
    Route::get('influencer-payments/{id}', [InfluencerPaymentController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_payments.view');
    Route::put('influencer-payments/{id}', [InfluencerPaymentController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_payments.update');
    Route::patch('influencer-payments/{id}', [InfluencerPaymentController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_payments.update');
    Route::post('influencer-payments/{id}/submit-validation', [InfluencerPaymentController::class, 'submitForValidation'])->whereNumber('id')->middleware('permission:influencer_payments.update');
    Route::post('influencer-payments/{id}/validate-n1', [InfluencerPaymentController::class, 'validateN1'])->whereNumber('id')->middleware('permission:influencer_payments.validate');
    Route::post('influencer-payments/{id}/validate-n2', [InfluencerPaymentController::class, 'validateN2'])->whereNumber('id')->middleware('permission:influencer_payments.validate');
    Route::post('influencer-payments/{id}/mark-paid', [InfluencerPaymentController::class, 'markPaid'])->whereNumber('id')->middleware('permission:influencer_payments.update');
    Route::delete('influencer-payments/{id}', [InfluencerPaymentController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_payments.delete');

    // ─── Influencer Documents ───
    Route::get('influencer-documents', [InfluencerDocumentController::class, 'index'])->middleware('permission:influencer_documents.view');
    Route::post('influencer-documents', [InfluencerDocumentController::class, 'store'])->middleware('permission:influencer_documents.create');
    Route::get('influencer-documents/{id}', [InfluencerDocumentController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_documents.view');
    Route::put('influencer-documents/{id}', [InfluencerDocumentController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_documents.update');
    Route::patch('influencer-documents/{id}', [InfluencerDocumentController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_documents.update');
    Route::delete('influencer-documents/{id}', [InfluencerDocumentController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_documents.delete');

    // ─── Influencer Performance (existing) ───
    Route::get('influencer-performance', [InfluencerPerformanceController::class, 'index'])->middleware('permission:influencer_performance.view');
    Route::post('influencer-performance', [InfluencerPerformanceController::class, 'store'])->middleware('permission:influencer_performance.create');
    Route::get('influencer-performance/{id}', [InfluencerPerformanceController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_performance.view');
    Route::put('influencer-performance/{id}', [InfluencerPerformanceController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_performance.update');
    Route::patch('influencer-performance/{id}', [InfluencerPerformanceController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_performance.update');
    Route::delete('influencer-performance/{id}', [InfluencerPerformanceController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_performance.delete');

    // ─── Influencer Messages (existing) ───
    Route::get('influencer-messages', [InfluencerMessageController::class, 'index'])->middleware('permission:influencer_messages.view');
    Route::post('influencer-messages', [InfluencerMessageController::class, 'store'])->middleware('permission:influencer_messages.create');
    Route::get('influencer-messages/{id}', [InfluencerMessageController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_messages.view');
    Route::put('influencer-messages/{id}', [InfluencerMessageController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_messages.update');
    Route::patch('influencer-messages/{id}', [InfluencerMessageController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_messages.update');
    Route::delete('influencer-messages/{id}', [InfluencerMessageController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_messages.delete');

    // ─── Influencer Complaints (existing) ───
    Route::get('influencer-complaints', [InfluencerComplaintController::class, 'index'])->middleware('permission:influencer_complaints.view');
    Route::post('influencer-complaints', [InfluencerComplaintController::class, 'store'])->middleware('permission:influencer_complaints.create');
    Route::get('influencer-complaints/{id}', [InfluencerComplaintController::class, 'show'])->whereNumber('id')->middleware('permission:influencer_complaints.view');
    Route::put('influencer-complaints/{id}', [InfluencerComplaintController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_complaints.update');
    Route::patch('influencer-complaints/{id}', [InfluencerComplaintController::class, 'update'])->whereNumber('id')->middleware('permission:influencer_complaints.update');
    Route::delete('influencer-complaints/{id}', [InfluencerComplaintController::class, 'destroy'])->whereNumber('id')->middleware('permission:influencer_complaints.delete');
    $registerCrud('charges', ChargeController::class, 'finance');
    Route::get('finance/contracts', [ClientContractController::class, 'index'])->middleware('permission:finance.view');
    Route::post('finance/contracts', [ClientContractController::class, 'store'])->middleware('permission:finance.create');
    Route::get('finance/contracts/{id}', [ClientContractController::class, 'show'])->whereNumber('id')->middleware('permission:finance.view');
    Route::put('finance/contracts/{id}', [ClientContractController::class, 'update'])->whereNumber('id')->middleware('permission:finance.update');
    Route::patch('finance/contracts/{id}', [ClientContractController::class, 'update'])->whereNumber('id')->middleware('permission:finance.update');
    Route::delete('finance/contracts/{id}', [ClientContractController::class, 'destroy'])->whereNumber('id')->middleware('permission:finance.delete');

    Route::get('finance/invoices', [ClientInvoiceController::class, 'index'])->middleware('permission:finance.view');
    Route::post('finance/invoices', [ClientInvoiceController::class, 'store'])->middleware('permission:finance.create');
    Route::post('finance/invoices/generate-monthly', [ClientInvoiceController::class, 'generateMonthly'])->middleware('permission:finance.create');
    Route::get('finance/invoices/{id}', [ClientInvoiceController::class, 'show'])->whereNumber('id')->middleware('permission:finance.view');
    Route::put('finance/invoices/{id}', [ClientInvoiceController::class, 'update'])->whereNumber('id')->middleware('permission:finance.update');
    Route::patch('finance/invoices/{id}', [ClientInvoiceController::class, 'update'])->whereNumber('id')->middleware('permission:finance.update');
    Route::delete('finance/invoices/{id}', [ClientInvoiceController::class, 'destroy'])->whereNumber('id')->middleware('permission:finance.delete');
    Route::post('finance/invoices/{id}/approve', [ClientInvoiceController::class, 'approve'])->whereNumber('id')->middleware('permission:finance.update');
    Route::post('finance/invoices/{id}/send', [ClientInvoiceController::class, 'send'])->whereNumber('id')->middleware('permission:finance.update');
    Route::get('finance/invoices/{id}/pdf', [ClientInvoiceController::class, 'downloadPdf'])->whereNumber('id')->middleware('permission:finance.view');
    Route::post('finance/invoices/{id}/send-whatsapp', [ClientInvoiceController::class, 'sendToWhatsApp'])->whereNumber('id')->middleware('permission:finance.view');
    Route::get('finance/summary', [FinanceSummaryController::class, 'summary'])->middleware('permission:finance.view');
    Route::get('finance/charges-by-type', [FinanceSummaryController::class, 'chargesByType'])->middleware('permission:finance.view');
    Route::get('finance/monthly', [FinanceSummaryController::class, 'monthly'])->middleware('permission:finance.view');

    // ── Accounting (comptabilite) ──
    Route::get('accounting/accounts', [AccountingController::class, 'accountsIndex'])->middleware('permission:accounting.view');
    Route::post('accounting/accounts', [AccountingController::class, 'accountsStore'])->middleware('permission:accounting.create');
    Route::put('accounting/accounts/{id}', [AccountingController::class, 'accountsUpdate'])->whereNumber('id')->middleware('permission:accounting.update');
    Route::delete('accounting/accounts/{id}', [AccountingController::class, 'accountsDestroy'])->whereNumber('id')->middleware('permission:accounting.delete');
    Route::get('accounting/entries', [AccountingController::class, 'entriesIndex'])->middleware('permission:accounting.view');
    Route::post('accounting/entries', [AccountingController::class, 'entriesStore'])->middleware('permission:accounting.create');
    Route::delete('accounting/entries/{id}', [AccountingController::class, 'entriesDestroy'])->whereNumber('id')->middleware('permission:accounting.delete');
    Route::get('accounting/summary', [AccountingController::class, 'summary'])->middleware('permission:accounting.view');
    Route::get('accounting/export-csv', [AccountingController::class, 'exportCsv'])->middleware('permission:accounting.view');

    Route::get('hr/lookups/{type}', [EmployeeController::class, 'lookups'])
        ->whereIn('type', ['department', 'role_title'])
        ->middleware('permission:hr.view');
    $registerCrud('hr', EmployeeController::class, 'hr');
    Route::prefix('academy')->group(function () {
        // Courses
        Route::get('courses', [AcademyCourseController::class, 'index']);
        Route::post('courses', [AcademyCourseController::class, 'store']);
        Route::get('courses/{id}', [AcademyCourseController::class, 'show'])->whereNumber('id');
        Route::put('courses/{id}', [AcademyCourseController::class, 'update'])->whereNumber('id');
        Route::patch('courses/{id}', [AcademyCourseController::class, 'update'])->whereNumber('id');
        Route::delete('courses/{id}', [AcademyCourseController::class, 'destroy'])->whereNumber('id');
        Route::post('courses/{id}/publish', [AcademyCourseController::class, 'publish'])->whereNumber('id');
        Route::post('courses/{id}/archive', [AcademyCourseController::class, 'archive'])->whereNumber('id');

        // Sections (nested under courses)
        Route::get('courses/{courseId}/sections', [AcademySectionController::class, 'index'])->whereNumber('courseId');
        Route::post('courses/{courseId}/sections', [AcademySectionController::class, 'store'])->whereNumber('courseId');
        Route::put('courses/{courseId}/sections/{id}', [AcademySectionController::class, 'update'])->whereNumber('courseId')->whereNumber('id');
        Route::delete('courses/{courseId}/sections/{id}', [AcademySectionController::class, 'destroy'])->whereNumber('courseId')->whereNumber('id');

        // Lessons (nested under courses)
        Route::get('courses/{courseId}/lessons', [AcademyLessonController::class, 'index'])->whereNumber('courseId');
        Route::post('courses/{courseId}/lessons', [AcademyLessonController::class, 'store'])->whereNumber('courseId');
        Route::put('courses/{courseId}/lessons/{id}', [AcademyLessonController::class, 'update'])->whereNumber('courseId')->whereNumber('id');
        Route::delete('courses/{courseId}/lessons/{id}', [AcademyLessonController::class, 'destroy'])->whereNumber('courseId')->whereNumber('id');

        // Quizzes (nested under courses)
        Route::get('courses/{courseId}/quizzes', [AcademyQuizController::class, 'index'])->whereNumber('courseId');
        Route::post('courses/{courseId}/quizzes', [AcademyQuizController::class, 'store'])->whereNumber('courseId');
        Route::get('courses/{courseId}/quizzes/{id}', [AcademyQuizController::class, 'show'])->whereNumber('courseId')->whereNumber('id');
        Route::put('courses/{courseId}/quizzes/{id}', [AcademyQuizController::class, 'update'])->whereNumber('courseId')->whereNumber('id');
        Route::delete('courses/{courseId}/quizzes/{id}', [AcademyQuizController::class, 'destroy'])->whereNumber('courseId')->whereNumber('id');

        // Students
        Route::get('students', [AcademyStudentController::class, 'index']);
        Route::post('students', [AcademyStudentController::class, 'store']);
        Route::get('students/{id}', [AcademyStudentController::class, 'show'])->whereNumber('id');
        Route::put('students/{id}', [AcademyStudentController::class, 'update'])->whereNumber('id');
        Route::delete('students/{id}', [AcademyStudentController::class, 'destroy'])->whereNumber('id');

        // Enrollments
        Route::get('enrollments', [AcademyEnrollmentController::class, 'index']);
        Route::post('enrollments', [AcademyEnrollmentController::class, 'store']);
        Route::post('enrollments/bulk', [AcademyEnrollmentController::class, 'bulkStore']);
        Route::put('enrollments/{id}', [AcademyEnrollmentController::class, 'update'])->whereNumber('id');
        Route::delete('enrollments/{id}', [AcademyEnrollmentController::class, 'destroy'])->whereNumber('id');
    });

    Route::get('hr/attendance', [HrAttendanceController::class, 'index'])->middleware('permission:hr.view');
    Route::post('hr/attendance/clock-in', [HrAttendanceController::class, 'clockIn']);
    Route::post('hr/attendance/manager-mark', [HrAttendanceController::class, 'managerMark'])->middleware('permission:hr.update');
    Route::patch('hr/attendance/{id}/justify', [HrAttendanceController::class, 'justify'])->whereNumber('id');
    Route::get('hr/payroll-summary', [HrAttendanceController::class, 'payrollSummary'])->middleware('permission:hr.view');

    // ─── HR Module Phase 2 ───
    Route::get('hr/dashboard/summary', [HrDashboardController::class, 'summary'])->middleware('permission:hr.view');

    // Leaves (Congés)
    Route::get('hr/leaves', [HrLeaveRequestController::class, 'index'])->middleware('permission:hr_leaves.view');
    Route::post('hr/leaves', [HrLeaveRequestController::class, 'store'])->middleware('permission:hr_leaves.create');
    Route::get('hr/leaves/{id}', [HrLeaveRequestController::class, 'show'])->whereNumber('id')->middleware('permission:hr_leaves.view');
    Route::put('hr/leaves/{id}', [HrLeaveRequestController::class, 'update'])->whereNumber('id')->middleware('permission:hr_leaves.update');
    Route::patch('hr/leaves/{id}', [HrLeaveRequestController::class, 'update'])->whereNumber('id')->middleware('permission:hr_leaves.update');
    Route::delete('hr/leaves/{id}', [HrLeaveRequestController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_leaves.update');
    Route::post('hr/leaves/{id}/approve', [HrLeaveRequestController::class, 'approve'])->whereNumber('id')->middleware('permission:hr_leaves.approve');
    Route::post('hr/leaves/{id}/refuse', [HrLeaveRequestController::class, 'refuse'])->whereNumber('id')->middleware('permission:hr_leaves.approve');

    // Recruitment - Job openings
    Route::get('hr/job-openings', [HrJobOpeningController::class, 'index'])->middleware('permission:hr_recruitment.view');
    Route::post('hr/job-openings', [HrJobOpeningController::class, 'store'])->middleware('permission:hr_recruitment.create');
    Route::get('hr/job-openings/{id}', [HrJobOpeningController::class, 'show'])->whereNumber('id')->middleware('permission:hr_recruitment.view');
    Route::put('hr/job-openings/{id}', [HrJobOpeningController::class, 'update'])->whereNumber('id')->middleware('permission:hr_recruitment.update');
    Route::patch('hr/job-openings/{id}', [HrJobOpeningController::class, 'update'])->whereNumber('id')->middleware('permission:hr_recruitment.update');
    Route::delete('hr/job-openings/{id}', [HrJobOpeningController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_recruitment.delete');
    Route::post('hr/job-openings/{id}/publish', [HrJobOpeningController::class, 'publish'])->whereNumber('id')->middleware('permission:hr_recruitment.update');
    Route::post('hr/job-openings/{id}/close', [HrJobOpeningController::class, 'close'])->whereNumber('id')->middleware('permission:hr_recruitment.update');

    // Recruitment - Candidates
    Route::get('hr/candidates', [HrCandidateController::class, 'index'])->middleware('permission:hr_recruitment.view');
    Route::post('hr/candidates', [HrCandidateController::class, 'store'])->middleware('permission:hr_recruitment.create');
    Route::get('hr/candidates/{id}', [HrCandidateController::class, 'show'])->whereNumber('id')->middleware('permission:hr_recruitment.view');
    Route::put('hr/candidates/{id}', [HrCandidateController::class, 'update'])->whereNumber('id')->middleware('permission:hr_recruitment.update');
    Route::patch('hr/candidates/{id}', [HrCandidateController::class, 'update'])->whereNumber('id')->middleware('permission:hr_recruitment.update');
    Route::delete('hr/candidates/{id}', [HrCandidateController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_recruitment.delete');
    Route::post('hr/candidates/{id}/transition', [HrCandidateController::class, 'transition'])->whereNumber('id')->middleware('permission:hr_recruitment.update');

    // Onboarding
    Route::get('hr/onboarding/items', [HrOnboardingController::class, 'index'])->middleware('permission:hr_onboarding.view');
    Route::post('hr/onboarding/init', [HrOnboardingController::class, 'initChecklist'])->middleware('permission:hr_onboarding.create');
    Route::post('hr/onboarding/items', [HrOnboardingController::class, 'addItem'])->middleware('permission:hr_onboarding.create');
    Route::post('hr/onboarding/items/{id}/toggle', [HrOnboardingController::class, 'toggle'])->whereNumber('id')->middleware('permission:hr_onboarding.update');

    // Payroll periods
    Route::get('hr/payroll-periods', [HrPayrollPeriodController::class, 'index'])->middleware('permission:hr_payroll.view');
    Route::post('hr/payroll-periods', [HrPayrollPeriodController::class, 'store'])->middleware('permission:hr_payroll.create');
    Route::get('hr/payroll-periods/{id}', [HrPayrollPeriodController::class, 'show'])->whereNumber('id')->middleware('permission:hr_payroll.view');
    Route::post('hr/payroll-periods/{id}/validate', [HrPayrollPeriodController::class, 'validate_'])->whereNumber('id')->middleware('permission:hr_payroll.validate');
    Route::post('hr/payroll-periods/{id}/close', [HrPayrollPeriodController::class, 'close'])->whereNumber('id')->middleware('permission:hr_payroll.validate');

    // Payroll bulletins
    Route::get('hr/payroll-bulletins', [HrPayrollBulletinController::class, 'index'])->middleware('permission:hr_payroll.view');
    Route::post('hr/payroll-bulletins', [HrPayrollBulletinController::class, 'store'])->middleware('permission:hr_payroll.create');
    Route::get('hr/payroll-bulletins/{id}', [HrPayrollBulletinController::class, 'show'])->whereNumber('id')->middleware('permission:hr_payroll.view');
    Route::put('hr/payroll-bulletins/{id}', [HrPayrollBulletinController::class, 'update'])->whereNumber('id')->middleware('permission:hr_payroll.update');
    Route::patch('hr/payroll-bulletins/{id}', [HrPayrollBulletinController::class, 'update'])->whereNumber('id')->middleware('permission:hr_payroll.update');
    Route::delete('hr/payroll-bulletins/{id}', [HrPayrollBulletinController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_payroll.update');
    Route::post('hr/payroll-bulletins/{id}/validate', [HrPayrollBulletinController::class, 'validate_'])->whereNumber('id')->middleware('permission:hr_payroll.validate');

    // Training
    Route::get('hr/trainings', [HrTrainingRecordController::class, 'index'])->middleware('permission:hr_training.view');
    Route::post('hr/trainings', [HrTrainingRecordController::class, 'store'])->middleware('permission:hr_training.create');
    Route::get('hr/trainings/{id}', [HrTrainingRecordController::class, 'show'])->whereNumber('id')->middleware('permission:hr_training.view');
    Route::put('hr/trainings/{id}', [HrTrainingRecordController::class, 'update'])->whereNumber('id')->middleware('permission:hr_training.update');
    Route::patch('hr/trainings/{id}', [HrTrainingRecordController::class, 'update'])->whereNumber('id')->middleware('permission:hr_training.update');
    Route::delete('hr/trainings/{id}', [HrTrainingRecordController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_training.delete');

    // Evaluation campaigns
    Route::get('hr/evaluation-campaigns', [HrEvaluationCampaignController::class, 'index'])->middleware('permission:hr_evaluations.view');
    Route::post('hr/evaluation-campaigns', [HrEvaluationCampaignController::class, 'store'])->middleware('permission:hr_evaluations.create');
    Route::get('hr/evaluation-campaigns/{id}', [HrEvaluationCampaignController::class, 'show'])->whereNumber('id')->middleware('permission:hr_evaluations.view');
    Route::put('hr/evaluation-campaigns/{id}', [HrEvaluationCampaignController::class, 'update'])->whereNumber('id')->middleware('permission:hr_evaluations.update');
    Route::patch('hr/evaluation-campaigns/{id}', [HrEvaluationCampaignController::class, 'update'])->whereNumber('id')->middleware('permission:hr_evaluations.update');
    Route::delete('hr/evaluation-campaigns/{id}', [HrEvaluationCampaignController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_evaluations.update');
    Route::post('hr/evaluation-campaigns/{id}/launch', [HrEvaluationCampaignController::class, 'launch'])->whereNumber('id')->middleware('permission:hr_evaluations.update');

    // Evaluations
    Route::get('hr/evaluations', [HrEvaluationController::class, 'index'])->middleware('permission:hr_evaluations.view');
    Route::post('hr/evaluations', [HrEvaluationController::class, 'store'])->middleware('permission:hr_evaluations.create');
    Route::get('hr/evaluations/{id}', [HrEvaluationController::class, 'show'])->whereNumber('id')->middleware('permission:hr_evaluations.view');
    Route::put('hr/evaluations/{id}', [HrEvaluationController::class, 'update'])->whereNumber('id')->middleware('permission:hr_evaluations.update');
    Route::patch('hr/evaluations/{id}', [HrEvaluationController::class, 'update'])->whereNumber('id')->middleware('permission:hr_evaluations.update');
    Route::delete('hr/evaluations/{id}', [HrEvaluationController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_evaluations.update');
    Route::post('hr/evaluations/{id}/sign-employee', [HrEvaluationController::class, 'signEmployee'])->whereNumber('id')->middleware('permission:hr_evaluations.update');
    Route::post('hr/evaluations/{id}/sign-manager', [HrEvaluationController::class, 'signManager'])->whereNumber('id')->middleware('permission:hr_evaluations.update');
    Route::post('hr/evaluations/{id}/finalize', [HrEvaluationController::class, 'finalize'])->whereNumber('id')->middleware('permission:hr_evaluations.finalize');

    // Career events
    Route::get('hr/career-events', [HrCareerEventController::class, 'index'])->middleware('permission:hr_career.view');
    Route::post('hr/career-events', [HrCareerEventController::class, 'store'])->middleware('permission:hr_career.create');
    Route::get('hr/career-events/{id}', [HrCareerEventController::class, 'show'])->whereNumber('id')->middleware('permission:hr_career.view');
    Route::put('hr/career-events/{id}', [HrCareerEventController::class, 'update'])->whereNumber('id')->middleware('permission:hr_career.update');
    Route::patch('hr/career-events/{id}', [HrCareerEventController::class, 'update'])->whereNumber('id')->middleware('permission:hr_career.update');
    Route::delete('hr/career-events/{id}', [HrCareerEventController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_career.update');

    // Discipline
    Route::get('hr/discipline', [HrDisciplineRecordController::class, 'index'])->middleware('permission:hr_discipline.view');
    Route::post('hr/discipline', [HrDisciplineRecordController::class, 'store'])->middleware('permission:hr_discipline.create');
    Route::get('hr/discipline/{id}', [HrDisciplineRecordController::class, 'show'])->whereNumber('id')->middleware('permission:hr_discipline.view');
    Route::put('hr/discipline/{id}', [HrDisciplineRecordController::class, 'update'])->whereNumber('id')->middleware('permission:hr_discipline.update');
    Route::patch('hr/discipline/{id}', [HrDisciplineRecordController::class, 'update'])->whereNumber('id')->middleware('permission:hr_discipline.update');
    Route::delete('hr/discipline/{id}', [HrDisciplineRecordController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_discipline.update');
    Route::post('hr/discipline/{id}/transition', [HrDisciplineRecordController::class, 'transition'])->whereNumber('id')->middleware('permission:hr_discipline.update');
    Route::post('hr/discipline/{id}/cancel', [HrDisciplineRecordController::class, 'cancel'])->whereNumber('id')->middleware('permission:hr_discipline.cancel');

    // HR Documents
    Route::get('hr/hr-documents', [HrDocumentController::class, 'index'])->middleware('permission:hr_documents.view');
    Route::post('hr/hr-documents', [HrDocumentController::class, 'store'])->middleware('permission:hr_documents.create');
    Route::get('hr/hr-documents/{id}', [HrDocumentController::class, 'show'])->whereNumber('id')->middleware('permission:hr_documents.view');
    Route::put('hr/hr-documents/{id}', [HrDocumentController::class, 'update'])->whereNumber('id')->middleware('permission:hr_documents.update');
    Route::patch('hr/hr-documents/{id}', [HrDocumentController::class, 'update'])->whereNumber('id')->middleware('permission:hr_documents.update');
    Route::delete('hr/hr-documents/{id}', [HrDocumentController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_documents.delete');

    // Internal communications
    Route::get('hr/communications', [HrCommunicationController::class, 'index'])->middleware('permission:hr_communications.view');
    Route::post('hr/communications', [HrCommunicationController::class, 'store'])->middleware('permission:hr_communications.create');
    Route::get('hr/communications/{id}', [HrCommunicationController::class, 'show'])->whereNumber('id')->middleware('permission:hr_communications.view');
    Route::put('hr/communications/{id}', [HrCommunicationController::class, 'update'])->whereNumber('id')->middleware('permission:hr_communications.update');
    Route::patch('hr/communications/{id}', [HrCommunicationController::class, 'update'])->whereNumber('id')->middleware('permission:hr_communications.update');
    Route::delete('hr/communications/{id}', [HrCommunicationController::class, 'destroy'])->whereNumber('id')->middleware('permission:hr_communications.update');
    Route::post('hr/communications/{id}/publish', [HrCommunicationController::class, 'publish'])->whereNumber('id')->middleware('permission:hr_communications.publish');
    Route::post('hr/communications/{id}/acknowledge', [HrCommunicationController::class, 'acknowledge'])->whereNumber('id');

    // ═══ SMM Module (Marketing → Réseaux sociaux → Stratégie & contenu) ═══
    Route::get('smm/dashboard/summary', [SmmDashboardController::class, 'summary'])->middleware('permission:smm_strategy.view');

    // Strategy
    Route::get('smm/strategies', [SmmStrategyController::class, 'index'])->middleware('permission:smm_strategy.view');
    Route::post('smm/strategies', [SmmStrategyController::class, 'store'])->middleware('permission:smm_strategy.create');
    Route::get('smm/strategies/{id}', [SmmStrategyController::class, 'show'])->whereNumber('id')->middleware('permission:smm_strategy.view');
    Route::put('smm/strategies/{id}', [SmmStrategyController::class, 'update'])->whereNumber('id')->middleware('permission:smm_strategy.update');
    Route::patch('smm/strategies/{id}', [SmmStrategyController::class, 'update'])->whereNumber('id')->middleware('permission:smm_strategy.update');
    Route::post('smm/strategies/{id}/submit', [SmmStrategyController::class, 'submit'])->whereNumber('id')->middleware('permission:smm_strategy.submit');
    Route::post('smm/strategies/{id}/validate', [SmmStrategyController::class, 'validateAction'])->whereNumber('id')->middleware('permission:smm_strategy.validate');
    Route::post('smm/strategies/{id}/reject', [SmmStrategyController::class, 'reject'])->whereNumber('id')->middleware('permission:smm_strategy.validate');
    Route::post('smm/strategies/{id}/request-modification', [SmmStrategyController::class, 'requestModification'])->whereNumber('id')->middleware('permission:smm_strategy.validate');
    Route::post('smm/strategies/{id}/solicit-contribution', [SmmStrategyController::class, 'solicitContribution'])->whereNumber('id')->middleware('permission:smm_strategy.submit');
    Route::post('smm/strategies/{id}/contribute', [SmmStrategyController::class, 'recordContribution'])->whereNumber('id');
    // Pillars nested under strategy
    Route::post('smm/strategies/{strategyId}/pillars', [SmmStrategyController::class, 'storePillar'])->whereNumber('strategyId')->middleware('permission:smm_strategy.create');
    Route::patch('smm/strategies/{strategyId}/pillars/{pillarId}', [SmmStrategyController::class, 'updatePillar'])->whereNumber('strategyId')->whereNumber('pillarId')->middleware('permission:smm_strategy.update');
    Route::delete('smm/strategies/{strategyId}/pillars/{pillarId}', [SmmStrategyController::class, 'destroyPillar'])->whereNumber('strategyId')->whereNumber('pillarId')->middleware('permission:smm_strategy.update');

    // Monthly plans
    Route::get('smm/plans', [SmmMonthlyPlanController::class, 'index'])->middleware('permission:smm_plans.view');
    Route::post('smm/plans', [SmmMonthlyPlanController::class, 'store'])->middleware('permission:smm_plans.create');
    Route::get('smm/plans/{id}', [SmmMonthlyPlanController::class, 'show'])->whereNumber('id')->middleware('permission:smm_plans.view');
    Route::put('smm/plans/{id}', [SmmMonthlyPlanController::class, 'update'])->whereNumber('id')->middleware('permission:smm_plans.update');
    Route::patch('smm/plans/{id}', [SmmMonthlyPlanController::class, 'update'])->whereNumber('id')->middleware('permission:smm_plans.update');
    Route::post('smm/plans/{id}/submit', [SmmMonthlyPlanController::class, 'submit'])->whereNumber('id')->middleware('permission:smm_plans.submit');
    Route::post('smm/plans/{id}/validate', [SmmMonthlyPlanController::class, 'validateAction'])->whereNumber('id')->middleware('permission:smm_plans.validate');
    Route::post('smm/plans/{id}/reject', [SmmMonthlyPlanController::class, 'reject'])->whereNumber('id')->middleware('permission:smm_plans.validate');
    Route::post('smm/plans/{id}/request-modification', [SmmMonthlyPlanController::class, 'requestModification'])->whereNumber('id')->middleware('permission:smm_plans.validate');

    // Contents (central pipeline)
    Route::get('smm/contents', [SmmContentController::class, 'index'])->middleware('permission:smm_contents.view');
    Route::post('smm/contents', [SmmContentController::class, 'store'])->middleware('permission:smm_contents.create');
    Route::get('smm/contents/{id}', [SmmContentController::class, 'show'])->whereNumber('id')->middleware('permission:smm_contents.view');
    Route::put('smm/contents/{id}', [SmmContentController::class, 'update'])->whereNumber('id')->middleware('permission:smm_contents.update');
    Route::patch('smm/contents/{id}', [SmmContentController::class, 'update'])->whereNumber('id')->middleware('permission:smm_contents.update');
    // Brief
    Route::put('smm/contents/{id}/brief', [SmmContentController::class, 'upsertBrief'])->whereNumber('id')->middleware('permission:smm_briefs.update');
    Route::post('smm/contents/{id}/mark-briefed', [SmmContentController::class, 'markBriefed'])->whereNumber('id')->middleware('permission:smm_contents.update');
    Route::post('smm/contents/{id}/acknowledge-reception', [SmmContentController::class, 'acknowledgeReception'])->whereNumber('id');
    // Versions & revisions
    Route::post('smm/contents/{id}/versions', [SmmContentController::class, 'uploadVersion'])->whereNumber('id');
    Route::post('smm/contents/{id}/revisions', [SmmContentController::class, 'addRevision'])->whereNumber('id')->middleware('permission:smm_contents.update');
    // QC
    Route::put('smm/contents/{id}/qc', [SmmContentController::class, 'runQc'])->whereNumber('id')->middleware('permission:smm_qc.run');
    // Validation
    Route::post('smm/contents/{id}/validate', [SmmContentController::class, 'validateAction'])->whereNumber('id')->middleware('permission:smm_contents.validate');
    Route::post('smm/contents/{id}/direction-validate', [SmmContentController::class, 'directionValidate'])->whereNumber('id')->middleware('permission:smm_contents.validate');
    // Publication slip
    Route::put('smm/contents/{id}/slip', [SmmContentController::class, 'upsertSlip'])->whereNumber('id')->middleware('permission:smm_publication.update');
    Route::post('smm/contents/{id}/transmit', [SmmContentController::class, 'transmit'])->whereNumber('id')->middleware('permission:smm_contents.transmit');
    // Publication state (CM only, but permission gated at role level)
    Route::post('smm/contents/{id}/set-published', [SmmContentController::class, 'setPublished'])->whereNumber('id');
    Route::post('smm/contents/{id}/set-not-published', [SmmContentController::class, 'setNotPublished'])->whereNumber('id');
    Route::post('smm/contents/{id}/cancel', [SmmContentController::class, 'cancel'])->whereNumber('id')->middleware('permission:smm_contents.update');

    // Execution checks
    Route::get('smm/execution-checks', [SmmExecutionCheckController::class, 'index'])->middleware('permission:smm_execution.view');
    Route::post('smm/execution-checks', [SmmExecutionCheckController::class, 'store'])->middleware('permission:smm_execution.create');
    Route::post('smm/execution-checks/{id}/correct', [SmmExecutionCheckController::class, 'correct'])->whereNumber('id')->middleware('permission:smm_execution.create');
    Route::post('smm/execution-checks/{id}/escalate', [SmmExecutionCheckController::class, 'escalate'])->whereNumber('id')->middleware('permission:smm_execution.escalate');

    // Veille
    Route::get('smm/veille/notes', [SmmVeilleController::class, 'indexNotes'])->middleware('permission:smm_veille.view');
    Route::post('smm/veille/notes', [SmmVeilleController::class, 'storeNote'])->middleware('permission:smm_veille.create');
    Route::get('smm/veille/notes/{id}', [SmmVeilleController::class, 'showNote'])->whereNumber('id')->middleware('permission:smm_veille.view');
    Route::patch('smm/veille/notes/{id}', [SmmVeilleController::class, 'updateNote'])->whereNumber('id')->middleware('permission:smm_veille.update');
    Route::post('smm/veille/notes/{noteId}/trends', [SmmVeilleController::class, 'storeTrend'])->whereNumber('noteId')->middleware('permission:smm_veille.create');
    Route::patch('smm/veille/notes/{noteId}/trends/{trendId}', [SmmVeilleController::class, 'updateTrend'])->whereNumber('noteId')->whereNumber('trendId')->middleware('permission:smm_veille.update');

    // Events
    Route::get('smm/events', [SmmEventController::class, 'index'])->middleware('permission:smm_events.view');
    Route::post('smm/events', [SmmEventController::class, 'store'])->middleware('permission:smm_events.create');
    Route::get('smm/events/{id}', [SmmEventController::class, 'show'])->whereNumber('id')->middleware('permission:smm_events.view');
    Route::patch('smm/events/{id}', [SmmEventController::class, 'update'])->whereNumber('id')->middleware('permission:smm_events.update');
    Route::post('smm/events/{id}/submit-retroplanning', [SmmEventController::class, 'submitRetroplanning'])->whereNumber('id')->middleware('permission:smm_events.update');
    Route::post('smm/events/{id}/validate-retroplanning', [SmmEventController::class, 'validateRetroplanning'])->whereNumber('id')->middleware('permission:smm_events.validate');
    Route::post('smm/events/{id}/validate-commercial-offer', [SmmEventController::class, 'validateCommercialOffer'])->whereNumber('id')->middleware('permission:smm_events.validate');

    // Automations
    Route::get('smm/automations', [SmmAutomationController::class, 'index'])->middleware('permission:smm_automations.view');
    Route::post('smm/automations', [SmmAutomationController::class, 'store'])->middleware('permission:smm_automations.create');
    Route::get('smm/automations/{id}', [SmmAutomationController::class, 'show'])->whereNumber('id')->middleware('permission:smm_automations.view');
    Route::patch('smm/automations/{id}', [SmmAutomationController::class, 'update'])->whereNumber('id')->middleware('permission:smm_automations.update');
    Route::post('smm/automations/{id}/record-test', [SmmAutomationController::class, 'recordTest'])->whereNumber('id')->middleware('permission:smm_automations.update');
    Route::post('smm/automations/{id}/activate', [SmmAutomationController::class, 'activate'])->whereNumber('id')->middleware('permission:smm_automations.activate');
    Route::post('smm/automations/{id}/suspend', [SmmAutomationController::class, 'suspend'])->whereNumber('id')->middleware('permission:smm_automations.suspend');
    Route::post('smm/automations/{id}/archive', [SmmAutomationController::class, 'archive'])->whereNumber('id')->middleware('permission:smm_automations.update');

    // Performance
    Route::get('smm/performance', [SmmPerformanceController::class, 'index'])->middleware('permission:smm_contents.view');
    Route::post('smm/performance', [SmmPerformanceController::class, 'upsert'])->middleware('permission:smm_contents.update');
    Route::get('smm/performance/{contentId}/snapshots', [SmmPerformanceController::class, 'snapshots'])->whereNumber('contentId')->middleware('permission:smm_contents.view');
    Route::post('smm/performance/sync-content/{contentId}', [SmmPerformanceController::class, 'syncContent'])->whereNumber('contentId')->middleware('permission:smm_contents.update');
    Route::post('smm/performance/sync-all', [SmmPerformanceController::class, 'syncAll'])->middleware('permission:smm_contents.update');

    // Learnings
    Route::get('smm/learnings', [SmmLearningController::class, 'index'])->middleware('permission:smm_learnings.view');
    Route::post('smm/learnings', [SmmLearningController::class, 'store'])->middleware('permission:smm_learnings.create');
    Route::patch('smm/learnings/{id}', [SmmLearningController::class, 'update'])->whereNumber('id')->middleware('permission:smm_learnings.update');
    Route::post('smm/learnings/{id}/mark-communicated', [SmmLearningController::class, 'markCommunicated'])->whereNumber('id')->middleware('permission:smm_learnings.update');

    // Monthly reports
    Route::get('smm/reports', [SmmMonthlyReportController::class, 'index'])->middleware('permission:smm_reports.view');
    Route::post('smm/reports', [SmmMonthlyReportController::class, 'store'])->middleware('permission:smm_reports.create');
    Route::get('smm/reports/{id}', [SmmMonthlyReportController::class, 'show'])->whereNumber('id')->middleware('permission:smm_reports.view');
    Route::patch('smm/reports/{id}', [SmmMonthlyReportController::class, 'update'])->whereNumber('id')->middleware('permission:smm_reports.update');
    Route::post('smm/reports/{id}/diffuse', [SmmMonthlyReportController::class, 'diffuse'])->whereNumber('id')->middleware('permission:smm_reports.diffuse');

    // Client insights
    Route::get('smm/insights', [SmmClientInsightController::class, 'index'])->middleware('permission:smm_insights.view');
    Route::post('smm/insights', [SmmClientInsightController::class, 'store'])->middleware('permission:smm_insights.create');
    Route::post('smm/insights/{id}/qualify', [SmmClientInsightController::class, 'qualify'])->whereNumber('id')->middleware('permission:smm_insights.qualify');
    Route::post('smm/insights/{id}/attach-content', [SmmClientInsightController::class, 'attachContent'])->whereNumber('id')->middleware('permission:smm_insights.update');
    Route::get('automations/runs', [AutomationRuleController::class, 'runs'])->middleware('permission:automations.view');
    Route::post('automations/rules/{id}/test', [AutomationRuleController::class, 'test'])->whereNumber('id')->middleware('permission:automations.run');
    Route::get('automations/rules', [AutomationRuleController::class, 'index'])->middleware('permission:automations.view');
    Route::post('automations/rules', [AutomationRuleController::class, 'store'])->middleware('permission:automations.create');
    Route::get('automations/rules/{id}', [AutomationRuleController::class, 'show'])->whereNumber('id')->middleware('permission:automations.view');
    Route::put('automations/rules/{id}', [AutomationRuleController::class, 'update'])->whereNumber('id')->middleware('permission:automations.update');
    Route::patch('automations/rules/{id}', [AutomationRuleController::class, 'update'])->whereNumber('id')->middleware('permission:automations.update');
    Route::delete('automations/rules/{id}', [AutomationRuleController::class, 'destroy'])->whereNumber('id')->middleware('permission:automations.delete');
    Route::get('client-portal/overview', [ClientPortalController::class, 'overview'])->middleware('permission:client_portal.view');
    Route::get('client-portal/access', [ClientPortalController::class, 'listAccesses'])->middleware('permission:client_portal.manage');
    Route::put('client-portal/access/{userId}', [ClientPortalController::class, 'updateAccess'])->whereNumber('userId')->middleware('permission:client_portal.manage');
    Route::get('daily-kpis', [DailyKpiController::class, 'index'])->middleware('permission:reports.view');
    Route::post('daily-kpis', [DailyKpiController::class, 'store'])->middleware('permission:reports.update');
    Route::get('daily-kpis/{id}', [DailyKpiController::class, 'show'])->whereNumber('id')->middleware('permission:reports.view');
    Route::put('daily-kpis/{id}', [DailyKpiController::class, 'update'])->whereNumber('id')->middleware('permission:reports.update');
    Route::patch('daily-kpis/{id}', [DailyKpiController::class, 'update'])->whereNumber('id')->middleware('permission:reports.update');
    Route::delete('daily-kpis/{id}', [DailyKpiController::class, 'destroy'])->whereNumber('id')->middleware('permission:reports.delete');

    Route::prefix('reports')->group(function () {
        Route::get('dashboard', [ReportController::class, 'dashboard'])->middleware('permission:reports.view');
        Route::get('commercial', [ReportController::class, 'commercial'])->middleware('permission:reports.view');
        Route::get('ads', [ReportController::class, 'ads'])->middleware('permission:reports.view');
        Route::get('stock', [ReportController::class, 'stock'])->middleware('permission:reports.view');
        Route::get('delivery', [ReportController::class, 'delivery'])->middleware('permission:reports.view');
        Route::get('finance', [ReportController::class, 'finance'])->middleware('permission:reports.view');
    });
    Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('permission:audit_logs.view');
    Route::get('audit-logs/lookups', [AuditLogController::class, 'lookups'])->middleware('permission:audit_logs.view');
    Route::get('audit-logs/{id}', [AuditLogController::class, 'show'])->whereNumber('id')->middleware('permission:audit_logs.view');

    // ── Community Manager Module ──
    Route::prefix('cm')->group(function () {
        Route::get('daily-summary', [CommunityManagerController::class, 'dailySummary'])->middleware('permission:cm_tracking.view');

        Route::get('checklists', [CommunityManagerController::class, 'indexChecklists'])->middleware('permission:cm_tracking.view');
        Route::post('checklists', [CommunityManagerController::class, 'storeChecklist'])->middleware('permission:cm_tracking.create');
        Route::get('checklists/{id}', [CommunityManagerController::class, 'showChecklist'])->whereNumber('id')->middleware('permission:cm_tracking.view');
        Route::put('checklists/{id}', [CommunityManagerController::class, 'updateChecklist'])->whereNumber('id')->middleware('permission:cm_tracking.update');
        Route::patch('checklists/{checklistId}/items/{itemId}/toggle', [CommunityManagerController::class, 'toggleChecklistItem'])->whereNumber('checklistId')->whereNumber('itemId')->middleware('permission:cm_tracking.update');
        Route::put('checklists/{checklistId}/items/{itemId}', [CommunityManagerController::class, 'updateChecklistItem'])->whereNumber('checklistId')->whereNumber('itemId')->middleware('permission:cm_tracking.update');

        Route::get('moderation', [CommunityManagerController::class, 'indexModeration'])->middleware('permission:cm_tracking.view');
        Route::post('moderation', [CommunityManagerController::class, 'storeModeration'])->middleware('permission:cm_tracking.create');
        Route::get('moderation/{id}', [CommunityManagerController::class, 'showModeration'])->whereNumber('id')->middleware('permission:cm_tracking.view');

        Route::get('influencer-content', [CommunityManagerController::class, 'indexInfluencerContent'])->middleware('permission:cm_tracking.view');
        Route::post('influencer-content', [CommunityManagerController::class, 'storeInfluencerContent'])->middleware('permission:cm_tracking.create');
        Route::patch('influencer-content/{id}/archive', [CommunityManagerController::class, 'archiveInfluencerContent'])->whereNumber('id')->middleware('permission:cm_tracking.update');

        Route::get('signals', [CommunityManagerController::class, 'indexSignals'])->middleware('permission:cm_tracking.view');
        Route::post('signals', [CommunityManagerController::class, 'storeSignal'])->middleware('permission:cm_tracking.create');
        Route::patch('signals/{id}/status', [CommunityManagerController::class, 'updateSignalStatus'])->whereNumber('id')->middleware('permission:cm_tracking.update');

        Route::get('notifications', [CommunityManagerController::class, 'indexNotifications'])->middleware('permission:cm_tracking.view');
        Route::patch('notifications/{id}/read', [CommunityManagerController::class, 'markNotificationRead'])->whereNumber('id')->middleware('permission:cm_tracking.view');
        Route::post('notifications/mark-all-read', [CommunityManagerController::class, 'markAllNotificationsRead'])->middleware('permission:cm_tracking.view');

        Route::get('templates', [CommunityManagerController::class, 'indexTemplates'])->middleware('permission:cm_tracking.view');
        Route::post('templates', [CommunityManagerController::class, 'storeTemplate'])->middleware('permission:cm_tracking.create');
        Route::put('templates/{id}', [CommunityManagerController::class, 'updateTemplate'])->whereNumber('id')->middleware('permission:cm_tracking.update');
        Route::delete('templates/{id}', [CommunityManagerController::class, 'deleteTemplate'])->whereNumber('id')->middleware('permission:cm_tracking.delete');

        Route::get('decision-points', [CommunityManagerController::class, 'indexDecisionPoints'])->middleware('permission:cm_tracking.view');
        Route::post('run-automations', [CommunityManagerController::class, 'runAutomations'])->middleware('permission:cm_tracking.update');
    });

    // ── Call Center Complaints ──
    Route::prefix('complaints')->group(function () {
        Route::get('/', [ComplaintController::class, 'index'])->middleware('permission:cm_tracking.view');
        Route::post('/', [ComplaintController::class, 'store'])->middleware('permission:cm_tracking.create');
        Route::get('{id}', [ComplaintController::class, 'show'])->whereNumber('id')->middleware('permission:cm_tracking.view');
        Route::put('{id}', [ComplaintController::class, 'update'])->whereNumber('id')->middleware('permission:cm_tracking.update');
        Route::get('{id}/thread', [ComplaintController::class, 'threadEntries'])->whereNumber('id')->middleware('permission:cm_tracking.view');
        Route::post('{id}/thread', [ComplaintController::class, 'addThreadEntry'])->whereNumber('id')->middleware('permission:cm_tracking.create');
    });

    // Lightweight endpoint: sidebar-nav visibility for ALL authenticated users (no settings.view required).
    Route::get('settings/sidebar-nav-visibility', [SettingsCenterController::class, 'sidebarNavVisibility']);
    Route::get('settings/product-options', [SettingsCenterController::class, 'productOptions']);
    Route::get('settings/supplier-categories', [SettingsCenterController::class, 'supplierCategories']);
    Route::post('settings/quick-add-list-item', [SettingsCenterController::class, 'quickAddListItem']);

    Route::get('settings/center/audit-history', [SettingsCenterController::class, 'auditHistory'])->middleware('permission:settings.view');
    Route::post('settings/center/test/smtp', [SettingsCenterController::class, 'testSmtp'])->middleware('permission:settings.update');
    Route::post('settings/center/test/whatsapp', [SettingsCenterController::class, 'testWhatsapp'])->middleware('permission:settings.update');
    Route::get('whatsapp/phone-numbers', [WhatsAppController::class, 'phoneNumbers'])->middleware('permission:settings.update');
    Route::get('whatsapp/numbers', [WhatsAppController::class, 'listNumbers'])->middleware('permission:conversations.view');
    Route::post('whatsapp/numbers', [WhatsAppController::class, 'addNumber'])->middleware('permission:settings.update');
    Route::patch('whatsapp/numbers/{id}', [WhatsAppController::class, 'updateNumber'])->whereNumber('id')->middleware('permission:settings.update');
    Route::delete('whatsapp/numbers/{id}', [WhatsAppController::class, 'deleteNumber'])->whereNumber('id')->middleware('permission:settings.update');
    Route::post('settings/center/test/meta', [SettingsCenterController::class, 'testMeta'])->middleware('permission:settings.update');
    Route::post('settings/center/test/delivery', [SettingsCenterController::class, 'testDelivery'])->middleware('permission:settings.update');
    Route::post('settings/center/upload/logo', [SettingsCenterController::class, 'uploadLogo'])->middleware('permission:settings.update');
    Route::get('settings/center/{section}', [SettingsCenterController::class, 'show'])
        ->middleware('permission:settings.view')
        ->whereIn('section', ['general', 'catalogue', 'integrations', 'delivery', 'whatsapp', 'meta', 'finance', 'security']);
    Route::put('settings/center/{section}', [SettingsCenterController::class, 'update'])
        ->middleware('permission:settings.update')
        ->whereIn('section', ['general', 'catalogue', 'integrations', 'delivery', 'whatsapp', 'meta', 'finance', 'security']);

    foreach (['settings', 'system-settings'] as $settingsPath) {
        Route::get($settingsPath, [SystemSettingController::class, 'index'])->middleware('permission:settings.view');
        Route::post($settingsPath, [SystemSettingController::class, 'store'])->middleware('permission:settings.create');
        Route::post("{$settingsPath}/sync-group", [SystemSettingController::class, 'syncGroup'])->middleware('permission:settings.update');
        Route::get("{$settingsPath}/{id}", [SystemSettingController::class, 'show'])->whereNumber('id')->middleware('permission:settings.view');
        Route::put("{$settingsPath}/{id}", [SystemSettingController::class, 'update'])->whereNumber('id')->middleware('permission:settings.update');
        Route::patch("{$settingsPath}/{id}", [SystemSettingController::class, 'update'])->whereNumber('id')->middleware('permission:settings.update');
        Route::delete("{$settingsPath}/{id}", [SystemSettingController::class, 'destroy'])->whereNumber('id')->middleware('permission:settings.delete');
    }
});
