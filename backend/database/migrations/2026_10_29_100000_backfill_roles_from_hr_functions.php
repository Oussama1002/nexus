<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasTable('hr_role_departments')) {
            return;
        }

        $titles = DB::table('hr_role_departments')->pluck('role_title')->unique();

        foreach ($titles as $title) {
            $title = trim((string) $title);
            $slug = Str::slug($title);
            if ($slug === '') {
                continue;
            }

            $exists = DB::table('roles')
                ->where('slug', $slug)
                ->orWhere('name', $title)
                ->exists();

            if (! $exists) {
                DB::table('roles')->insert([
                    'name' => $title,
                    'slug' => $slug,
                    'description' => 'Fonction RH',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Additif : on ne supprime pas les rôles créés depuis les fonctions RH.
    }
};
