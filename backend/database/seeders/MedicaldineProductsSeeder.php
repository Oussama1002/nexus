<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class MedicaldineProductsSeeder extends Seeder
{
    public function run(): void
    {
        $brand = Brand::where('name', 'like', '%edicaldine%')->first();

        if (!$brand) {
            $this->command->error('Brand "Medicaldine" not found!');
            return;
        }

        $products = [
            // Perte de poids
            [
                'name' => 'SharSlim',
                'description' => 'Complément naturel pour la perte de poids à base de plantes ayurvédiques.',
                'category' => 'Perte de poids',
                'product_type' => 'complement',
                'price' => 450,
                'cost' => 550,
            ],
            [
                'name' => 'Burn Fat Drink',
                'description' => 'Boisson brûle-graisses naturelle pour accompagner un programme minceur.',
                'category' => 'Perte de poids',
                'product_type' => 'boisson',
                'price' => 300,
                'cost' => 350,
            ],
            [
                'name' => 'Fat Burn Belly Cream',
                'description' => 'Crème amincissante ciblée pour la zone abdominale.',
                'category' => 'Perte de poids',
                'product_type' => 'creme',
                'price' => 289,
                'cost' => 340,
            ],

            // Prise de poids
            [
                'name' => 'Shatavari Protein',
                'description' => 'Protéine végétale enrichie au Shatavari pour une prise de poids saine.',
                'category' => 'Prise de poids',
                'product_type' => 'complement',
                'price' => 450,
                'cost' => 530,
            ],
            [
                'name' => 'Herbal Mass Tonic',
                'description' => 'Tonique à base de plantes pour favoriser la prise de masse.',
                'category' => 'Prise de poids',
                'product_type' => 'tonique',
                'price' => 300,
                'cost' => 370,
            ],
            [
                'name' => 'Butt Lifting Massage',
                'description' => 'Crème de massage pour le galbe et le raffermissement.',
                'category' => 'Prise de poids',
                'product_type' => 'creme',
                'price' => 289,
                'cost' => 340,
            ],

            // Digestion & Colon
            [
                'name' => 'Colon Care',
                'description' => 'Formule naturelle pour le nettoyage et le soin du côlon.',
                'category' => 'Digestion & Colon',
                'product_type' => 'complement',
                'price' => 450,
                'cost' => 560,
            ],
            [
                'name' => 'Intestiheal Tonic',
                'description' => 'Tonique réparateur pour la santé intestinale.',
                'category' => 'Digestion & Colon',
                'product_type' => 'tonique',
                'price' => 300,
                'cost' => 370,
            ],
            [
                'name' => 'Intesticalm Cream',
                'description' => 'Crème apaisante pour le confort digestif.',
                'category' => 'Digestion & Colon',
                'product_type' => 'creme',
                'price' => 289,
                'cost' => 340,
            ],

            // Immunité
            [
                'name' => 'Energia',
                'description' => 'Complément énergisant et renforçateur du système immunitaire.',
                'category' => 'Immunité',
                'product_type' => 'complement',
                'price' => 450,
                'cost' => 530,
            ],

            // Soins capillaires
            [
                'name' => 'GreyShield Spray',
                'description' => 'Spray anti-cheveux gris à base d\'extraits naturels.',
                'category' => 'Soins capillaires',
                'product_type' => 'spray',
                'price' => 320,
                'cost' => 380,
            ],
            [
                'name' => 'RevitaHair Oil',
                'description' => 'Huile revitalisante pour cheveux secs et abîmés.',
                'category' => 'Soins capillaires',
                'product_type' => 'huile',
                'price' => 320,
                'cost' => 400,
            ],
            [
                'name' => 'AyurQuench Shampoo',
                'description' => 'Shampooing hydratant aux herbes ayurvédiques.',
                'category' => 'Soins capillaires',
                'product_type' => 'shampooing',
                'price' => 280,
                'cost' => 330,
            ],
            [
                'name' => 'HerbalBalance Shampoo',
                'description' => 'Shampooing équilibrant pour cuir chevelu sensible.',
                'category' => 'Soins capillaires',
                'product_type' => 'shampooing',
                'price' => 280,
                'cost' => 330,
            ],
            [
                'name' => 'Shakti Hair Mask',
                'description' => 'Masque capillaire nourrissant et fortifiant.',
                'category' => 'Soins capillaires',
                'product_type' => 'masque',
                'price' => 350,
                'cost' => 420,
            ],

            // Packs
            [
                'name' => 'Pack Minceur Complet',
                'description' => 'Pack complet minceur : SharSlim + Burn Fat Drink + Fat Burn Belly Cream.',
                'category' => 'Packs',
                'product_type' => 'pack',
                'price' => 749,
                'cost' => 959,
            ],
            [
                'name' => 'Pack Nutrition & Courbes',
                'description' => 'Pack prise de poids : Shatavari Protein + Herbal Mass Tonic + Butt Lifting Massage.',
                'category' => 'Packs',
                'product_type' => 'pack',
                'price' => 699,
                'cost' => 900,
            ],
            [
                'name' => 'Pack Confort Digestif',
                'description' => 'Pack digestion : Colon Care + Intestiheal Tonic + Intesticalm Cream.',
                'category' => 'Packs',
                'product_type' => 'pack',
                'price' => 649,
                'cost' => 830,
            ],
            [
                'name' => 'Pack Capillaire Ayurvédique',
                'description' => 'Pack soins capillaires complet : GreyShield + RevitaHair + AyurQuench + HerbalBalance + Shakti.',
                'category' => 'Packs',
                'product_type' => 'pack',
                'price' => 899,
                'cost' => 1160,
            ],
        ];

        $count = 0;
        foreach ($products as $p) {
            $sku = strtoupper(Str::slug($brand->code . '-' . $p['name'], '-'));

            if (Product::where('brand_id', $brand->id)->where('name', $p['name'])->exists()) {
                $this->command->warn("Skipped (already exists): {$p['name']}");
                continue;
            }

            Product::create(array_merge($p, [
                'brand_id' => $brand->id,
                'sku' => $sku,
                'stock_quantity' => 0,
                'status' => 'active',
            ]));
            $count++;
        }

        $this->command->info("Created {$count} products for brand: {$brand->name} (ID {$brand->id})");
    }
}
