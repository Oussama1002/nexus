<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Archive des commandes : on ne supprime plus, on met de côté (restaurable).
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders') || Schema::hasColumn('orders', 'archived_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'archived_at')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('archived_at');
            });
        }
    }
};
