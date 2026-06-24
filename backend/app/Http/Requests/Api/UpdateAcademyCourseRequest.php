<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAcademyCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'course_category_id' => ['sometimes', 'nullable', 'integer', 'exists:course_categories,id'],
            'certificate_template_id' => ['sometimes', 'nullable', 'integer', 'exists:certificate_templates,id'],
            'title' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255'],
            'short_description' => ['sometimes', 'nullable', 'string'],
            'description' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', Rule::in(['draft', 'published', 'archived'])],
            'enrollment_type' => ['sometimes', Rule::in(['free', 'paid'])],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'thumbnail_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'cover_image_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'duration_minutes' => ['sometimes', 'integer', 'min:0'],
            'difficulty_level' => ['sometimes', Rule::in(['beginner', 'intermediate', 'advanced'])],
            'learning_objectives' => ['sometimes', 'nullable', 'array'],
            'learning_objectives.*' => ['string', 'max:255'],
            'prerequisites' => ['sometimes', 'nullable', 'array'],
            'prerequisites.*' => ['string', 'max:255'],
            'seo_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'seo_description' => ['sometimes', 'nullable', 'string'],
            'seo_keywords' => ['sometimes', 'nullable', 'array'],
            'seo_keywords.*' => ['string', 'max:120'],
            'is_featured' => ['sometimes', 'boolean'],
        ];
    }
}
