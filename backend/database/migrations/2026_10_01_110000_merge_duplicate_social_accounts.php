<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Un même compte Instagram pouvait être importé deux fois : la Page Facebook
 * expose l'identifiant « business account », la connexion Instagram directe
 * en expose un autre. On ne garde que la première ligne par pseudo.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('social_accounts') || ! Schema::hasColumn('social_accounts', 'handle')) {
            return;
        }

        $groups = DB::table('social_accounts')
            ->selectRaw('brand_id, platform, LOWER(TRIM(handle)) as h, COUNT(*) as total')
            ->whereNotNull('handle')
            ->where('handle', '!=', '')
            ->groupBy('brand_id', 'platform', 'h')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($groups as $group) {
            $ids = DB::table('social_accounts')
                ->where('brand_id', $group->brand_id)
                ->where('platform', $group->platform)
                ->whereRaw('LOWER(TRIM(handle)) = ?', [$group->h])
                ->orderBy('id')
                ->pluck('id')
                ->all();

            // La plus ancienne est conservée.
            $keep = array_shift($ids);
            if ($ids === []) {
                continue;
            }

            // Les clés étrangères sont en nullOnDelete : sans ce report, les
            // publications du doublon perdraient leur compte.
            foreach ($this->referencingTables() as $table) {
                DB::table($table)->whereIn('social_account_id', $ids)->update(['social_account_id' => $keep]);
            }

            DB::table('social_accounts')->whereIn('id', $ids)->delete();
        }
    }

    public function down(): void
    {
        // Suppression de doublons : rien à rétablir.
    }

    /**
     * Toutes les tables portant une colonne social_account_id, découvertes
     * plutôt qu'énumérées : la liste change au fil des modules.
     *
     * @return list<string>
     */
    private function referencingTables(): array
    {
        if (DB::getDriverName() !== 'mysql') {
            return [];
        }

        return DB::table('information_schema.columns')
            ->where('table_schema', DB::getDatabaseName())
            ->where('column_name', 'social_account_id')
            ->pluck('table_name')
            ->filter(fn ($t) => $t !== 'social_accounts')
            ->values()
            ->all();
    }
};
