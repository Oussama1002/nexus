<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'origin_lead_id')) {
                $table->foreignId('origin_lead_id')->nullable()->after('brand_id')->constrained('leads')->nullOnDelete();
            }
            if (! Schema::hasColumn('customers', 'assigned_user_id')) {
                $table->foreignId('assigned_user_id')->nullable()->after('origin_lead_id')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('customers', 'client_source')) {
                $table->string('client_source', 40)->nullable()->after('assigned_user_id');
            }
            if (! Schema::hasColumn('customers', 'phone_secondary')) {
                $table->string('phone_secondary', 30)->nullable()->after('phone');
            }
            if (! Schema::hasColumn('customers', 'neighborhood')) {
                $table->string('neighborhood', 120)->nullable()->after('city');
            }
            if (! Schema::hasColumn('customers', 'lifecycle_status')) {
                $table->string('lifecycle_status', 32)->nullable()->after('status');
            }
            if (! Schema::hasColumn('customers', 'client_type')) {
                $table->string('client_type', 32)->nullable()->after('lifecycle_status');
            }
            if (! Schema::hasColumn('customers', 'interest_level')) {
                $table->string('interest_level', 32)->nullable()->after('client_type');
            }
            if (! Schema::hasColumn('customers', 'delivery_city')) {
                $table->string('delivery_city', 120)->nullable()->after('address');
            }
            if (! Schema::hasColumn('customers', 'delivery_address')) {
                $table->text('delivery_address')->nullable()->after('delivery_city');
            }
            if (! Schema::hasColumn('customers', 'delivery_landmark')) {
                $table->string('delivery_landmark', 255)->nullable()->after('delivery_address');
            }
            if (! Schema::hasColumn('customers', 'delivery_zone')) {
                $table->string('delivery_zone', 120)->nullable()->after('delivery_landmark');
            }
            if (! Schema::hasColumn('customers', 'default_shipping_fee')) {
                $table->decimal('default_shipping_fee', 12, 2)->nullable()->after('delivery_zone');
            }
            if (! Schema::hasColumn('customers', 'preferred_products')) {
                $table->text('preferred_products')->nullable()->after('default_shipping_fee');
            }
            if (! Schema::hasColumn('customers', 'preferred_variant')) {
                $table->string('preferred_variant', 255)->nullable()->after('preferred_products');
            }
            if (! Schema::hasColumn('customers', 'preferred_language')) {
                $table->string('preferred_language', 32)->nullable()->after('preferred_variant');
            }
            if (! Schema::hasColumn('customers', 'preferred_payment')) {
                $table->string('preferred_payment', 32)->nullable()->after('preferred_language');
            }
            if (! Schema::hasColumn('customers', 'internal_notes')) {
                $table->text('internal_notes')->nullable()->after('preferred_payment');
            }
            if (! Schema::hasColumn('customers', 'blacklist_reason')) {
                $table->text('blacklist_reason')->nullable()->after('internal_notes');
            }
            if (! Schema::hasColumn('customers', 'risk_score')) {
                $table->unsignedTinyInteger('risk_score')->nullable()->after('blacklist_reason');
            }
        });

        if (Schema::hasColumn('customers', 'lifecycle_status')) {
            DB::table('customers')->whereNull('lifecycle_status')->orderBy('id')->chunkById(100, function ($rows) {
                foreach ($rows as $row) {
                    $legacy = $row->status ?? 'active';
                    $lifecycle = match ($legacy) {
                        'inactive' => 'inactive',
                        'blacklisted' => 'blacklisted',
                        default => 'active',
                    };
                    DB::table('customers')->where('id', $row->id)->update(['lifecycle_status' => $lifecycle]);
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'assigned_user_id')) {
                $table->dropForeign(['assigned_user_id']);
            }
            if (Schema::hasColumn('customers', 'origin_lead_id')) {
                $table->dropForeign(['origin_lead_id']);
            }
        });

        Schema::table('customers', function (Blueprint $table) {
            foreach ([
                'risk_score',
                'blacklist_reason',
                'internal_notes',
                'preferred_payment',
                'preferred_language',
                'preferred_variant',
                'preferred_products',
                'default_shipping_fee',
                'delivery_zone',
                'delivery_landmark',
                'delivery_address',
                'delivery_city',
                'interest_level',
                'client_type',
                'lifecycle_status',
                'neighborhood',
                'phone_secondary',
                'client_source',
                'assigned_user_id',
                'origin_lead_id',
            ] as $col) {
                if (Schema::hasColumn('customers', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
