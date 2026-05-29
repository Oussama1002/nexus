<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            if (Schema::hasColumn('employees', 'position') && ! Schema::hasColumn('employees', 'role_title')) {
                DB::statement('ALTER TABLE employees CHANGE position role_title VARCHAR(255) NULL');
            }
            if (Schema::hasColumn('employees', 'hire_date') && ! Schema::hasColumn('employees', 'joined_at')) {
                DB::statement('ALTER TABLE employees CHANGE hire_date joined_at DATE NULL');
            }
        } else {
            Schema::table('employees', function (Blueprint $table) {
                if (Schema::hasColumn('employees', 'position') && ! Schema::hasColumn('employees', 'role_title')) {
                    $table->renameColumn('position', 'role_title');
                }
            });
            Schema::table('employees', function (Blueprint $table) {
                if (Schema::hasColumn('employees', 'hire_date') && ! Schema::hasColumn('employees', 'joined_at')) {
                    $table->renameColumn('hire_date', 'joined_at');
                }
            });
        }

        Schema::table('employees', function (Blueprint $table) {
            if (! Schema::hasColumn('employees', 'phone')) {
                $table->string('phone', 30)->nullable()->after('full_name');
            }
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $this->migrateChargeTypesMysql();
        } else {
            $this->mapChargeTypesSqlite();
        }

        Schema::table('system_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('system_settings', 'setting_group')) {
                $table->string('setting_group', 50)->default('general')->after('setting_key');
            }
            if (! Schema::hasColumn('system_settings', 'is_sensitive')) {
                $table->boolean('is_sensitive')->default(false);
            }
        });
    }

    private function migrateChargeTypesMysql(): void
    {
        if (! Schema::hasTable('charges')) {
            return;
        }
        DB::statement('ALTER TABLE charges MODIFY type VARCHAR(32) NOT NULL DEFAULT "other"');
        $map = [
            'purchase_price' => 'supplier',
            'ads_fee' => 'ads',
            'delivery_fee' => 'delivery',
            'confirmation_fee' => 'other',
            'packaging_fee' => 'other',
            'transport_fee' => 'delivery',
            'content_fee' => 'influencer',
            'gift_fee' => 'other',
            'risk_fee' => 'other',
            'other_fee' => 'other',
        ];
        foreach ($map as $old => $new) {
            DB::table('charges')->where('type', $old)->update(['type' => $new]);
        }
        DB::statement("ALTER TABLE charges MODIFY type ENUM('ads','salary','delivery','supplier','rent','tools','influencer','other') NOT NULL DEFAULT 'other'");
    }

    private function mapChargeTypesSqlite(): void
    {
        if (! Schema::hasTable('charges')) {
            return;
        }
        $map = [
            'purchase_price' => 'supplier',
            'ads_fee' => 'ads',
            'delivery_fee' => 'delivery',
            'confirmation_fee' => 'other',
            'packaging_fee' => 'other',
            'transport_fee' => 'delivery',
            'content_fee' => 'influencer',
            'gift_fee' => 'other',
            'risk_fee' => 'other',
            'other_fee' => 'other',
        ];
        foreach ($map as $old => $new) {
            DB::table('charges')->where('type', $old)->update(['type' => $new]);
        }
    }

    public function down(): void
    {
        // best-effort only
    }
};
