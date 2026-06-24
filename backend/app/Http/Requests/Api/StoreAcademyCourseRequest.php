<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAcademyCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'course_category_id' => ['nullable', 'integer', 'exists:course_categories,id'],
            'certificate_template_id' => ['nullable', 'integer', 'exists:certificate_templates,id'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'short_description' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['draft', 'published', 'archived'])],
            'enrollment_type' => ['nullable', Rule::in(['free', 'paid'])],
            'price' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'thumbnail_url' => ['nullable', 'url', 'max:2048'],
            'cover_image_url' => ['nullable', 'url', 'max:2048'],
            'duration_minutes' => ['nullable', 'integer', 'min:0'],
            'difficulty_level' => ['nullable', Rule::in(['beginner', 'intermediate', 'advanced'])],
            'learning_objectives' => ['nullable', 'array'],
            'learning_objectives.*' => ['string', 'max:255'],
            'prerequisites' => ['nullable', 'array'],
            'prerequisites.*' => ['string', 'max:255'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string'],
            'seo_keywords' => ['nullable', 'array'],
            'seo_keywords.*' => ['string', 'max:120'],
            'is_featured' => ['nullable', 'boolean'],
        ];
    }
}
