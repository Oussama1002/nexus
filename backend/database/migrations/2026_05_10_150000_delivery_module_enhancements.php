<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_companies', function (Blueprint $table) {
            if (! Schema::hasColumn('delivery_companies', 'code')) {
                $table->string('code', 64)->nullable()->after('id');
            }
            if (! Schema::hasColumn('delivery_companies', 'email')) {
                $table->string('email')->nullable()->after('phone');
            }
            if (! Schema::hasColumn('delivery_companies', 'api_url')) {
                $table->string('api_url', 512)->nullable()->after('api_key');
            }
            if (! Schema::hasColumn('delivery_companies', 'api_key_ref')) {
                $table->string('api_key_ref', 190)->nullable()->after('api_url');
            }
            if (! Schema::hasColumn('delivery_companies', 'avg_cost')) {
                $table->decimal('avg_cost', 12, 2)->nullable()->after('tracking_base_url');
            }
            if (! Schema::hasColumn('delivery_companies', 'avg_delivery_days')) {
                $table->unsignedSmallInteger('avg_delivery_days')->nullable()->after('avg_cost');
            }
            if (! Schema::hasColumn('delivery_companies', 'notes')) {
                $table->text('notes')->nullable()->after('status');
            }
        });

        if (Schema::hasColumn('delivery_companies', 'tracking_base_url') && Schema::hasColumn('delivery_companies', 'api_url')) {
            DB::table('delivery_companies')->whereNull('api_url')->whereNotNull('tracking_base_url')->update([
                'api_url' => DB::raw('tracking_base_url'),
            ]);
        }
        if (Schema::hasColumn('delivery_companies', 'api_key') && Schema::hasColumn('delivery_companies', 'api_key_ref')) {
            DB::table('delivery_companies')->whereNull('api_key_ref')->whereNotNull('api_key')->update([
                'api_key_ref' => DB::raw('api_key'),
            ]);
        }

        Schema::table('shipments', function (Blueprint $table) {
            if (! Schema::hasColumn('shipments', 'external_tracking_id')) {
                $table->string('external_tracking_id', 190)->nullable()->after('tracking_number');
            }
            if (! Schema::hasColumn('shipments', 'recipient_city')) {
                $table->string('recipient_city', 120)->nullable()->after('recipient_phone');
            }
            if (! Schema::hasColumn('shipments', 'recipient_address')) {
                $table->text('recipient_address')->nullable()->after('recipient_city');
            }
            if (! Schema::hasColumn('shipments', 'delivery_fee')) {
                $table->decimal('delivery_fee', 12, 2)->default(0)->after('cod_amount');
            }
            if (! Schema::hasColumn('shipments', 'insurance_fee')) {
                $table->decimal('insurance_fee', 12, 2)->default(0)->after('delivery_fee');
            }
            if (! Schema::hasColumn('shipments', 'payment_status')) {
                $table->string('payment_status', 32)->default('not_applicable')->after('status');
            }
            if (! Schema::hasColumn('shipments', 'carrier_status')) {
                $table->string('carrier_status', 120)->nullable()->after('payment_status');
            }
            if (! Schema::hasColumn('shipments', 'carrier_response_json')) {
                $table->json('carrier_response_json')->nullable()->after('carrier_status');
            }
            if (! Schema::hasColumn('shipments', 'carrier_label_url')) {
                $table->string('carrier_label_url', 512)->nullable()->after('carrier_response_json');
            }
            if (! Schema::hasColumn('shipments', 'carrier_last_sync_at')) {
                $table->timestamp('carrier_last_sync_at')->nullable()->after('carrier_label_url');
            }
            if (! Schema::hasColumn('shipments', 'sync_error')) {
                $table->text('sync_error')->nullable()->after('carrier_last_sync_at');
            }
            if (! Schema::hasColumn('shipments', 'failure_reason')) {
                $table->text('failure_reason')->nullable()->after('sync_error');
            }
            if (! Schema::hasColumn('shipments', 'return_reason')) {
                $table->text('return_reason')->nullable()->after('failure_reason');
            }
            if (! Schema::hasColumn('shipments', 'pickup_date')) {
                $table->date('pickup_date')->nullable()->after('address');
            }
            if (! Schema::hasColumn('shipments', 'returned_at')) {
                $table->timestamp('returned_at')->nullable()->after('delivered_at');
            }
            if (! Schema::hasColumn('shipments', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('notes')->constrained('users')->nullOnDelete();
            }
        });

        if (Schema::hasColumn('shipments', 'city') && Schema::hasColumn('shipments', 'recipient_city')) {
            DB::statement('UPDATE shipments SET recipient_city = city WHERE recipient_city IS NULL AND city IS NOT NULL');
        }
        if (Schema::hasColumn('shipments', 'address') && Schema::hasColumn('shipments', 'recipient_address')) {
            DB::statement('UPDATE shipments SET recipient_address = address WHERE recipient_address IS NULL AND address IS NOT NULL');
        }

        Schema::table('shipment_events', function (Blueprint $table) {
            if (! Schema::hasColumn('shipment_events', 'location')) {
                $table->string('location', 255)->nullable()->after('status');
            }
            if (! Schema::hasColumn('shipment_events', 'description')) {
                $table->text('description')->nullable()->after('location');
            }
            if (! Schema::hasColumn('shipment_events', 'raw_payload_json')) {
                $table->json('raw_payload_json')->nullable()->after('description');
            }
        });

        Schema::table('delivery_payments', function (Blueprint $table) {
            if (! Schema::hasColumn('delivery_payments', 'reference')) {
                $table->string('reference', 190)->nullable()->after('delivery_company_id');
            }
        });

        if (Schema::hasColumn('delivery_payments', 'label') && Schema::hasColumn('delivery_payments', 'reference')) {
            DB::table('delivery_payments')->whereNull('reference')->update(['reference' => DB::raw('label')]);
        }

        if (Schema::hasColumn('delivery_companies', 'code')) {
            Schema::table('delivery_companies', function (Blueprint $table) {
                $table->index('code');
            });
        }
    }

    public function down(): void
    {
        Schema::table('delivery_companies', function (Blueprint $table) {
            if (Schema::hasColumn('delivery_companies', 'code')) {
                $table->dropIndex(['code']);
            }
        });

        Schema::table('shipments', function (Blueprint $table) {
            if (Schema::hasColumn('shipments', 'created_by')) {
                $table->dropForeign(['created_by']);
            }
            foreach ([
                'created_by',
                'returned_at',
                'pickup_date',
                'return_reason',
                'failure_reason',
                'sync_error',
                'carrier_last_sync_at',
                'carrier_label_url',
                'carrier_response_json',
                'carrier_status',
                'payment_status',
                'insurance_fee',
                'delivery_fee',
                'recipient_address',
                'recipient_city',
                'external_tracking_id',
            ] as $col) {
                if (Schema::hasColumn('shipments', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('shipment_events', function (Blueprint $table) {
            foreach (['raw_payload_json', 'description', 'location'] as $col) {
                if (Schema::hasColumn('shipment_events', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('delivery_payments', function (Blueprint $table) {
            if (Schema::hasColumn('delivery_payments', 'reference')) {
                $table->dropColumn('reference');
            }
        });

        Schema::table('delivery_companies', function (Blueprint $table) {
            foreach (['notes', 'avg_delivery_days', 'avg_cost', 'api_key_ref', 'api_url', 'email', 'code'] as $col) {
                if (Schema::hasColumn('delivery_companies', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
