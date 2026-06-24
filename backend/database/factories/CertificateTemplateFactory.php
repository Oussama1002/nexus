<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\CertificateTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

class CertificateTemplateFactory extends Factory
{
    protected $model = CertificateTemplate::class;

    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            'name' => 'Default '.fake()->word().' template',
            'html_template' => '<h1>{{student_name}}</h1><p>{{course_title}}</p>',
            'background_image_url' => null,
            'signature_image_url' => null,
            'is_active' => true,
        ];
    }
}
