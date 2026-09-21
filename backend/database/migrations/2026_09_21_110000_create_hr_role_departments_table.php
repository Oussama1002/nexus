<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fonction → Département, edited in Centre de paramètres → RH and used by the
// Nouvel employé form. HR is cross-brand, so no brand_id.
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_role_departments')) {
            return;
        }

        Schema::create('hr_role_departments', function (Blueprint $table) {
            $table->id();
            $table->string('role_title', 191)->unique();
            $table->string('department', 191);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_role_departments');
    }
};
