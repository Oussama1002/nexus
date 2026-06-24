<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'brand_id' => $this->brand_id,
            'title' => $this->title,
            'slug' => $this->slug,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'status' => $this->status,
            'enrollment_type' => $this->enrollment_type,
            'price' => $this->price,
            'currency' => $this->currency,
            'thumbnail_url' => $this->thumbnail_url,
            'cover_image_url' => $this->cover_image_url,
            'duration_minutes' => $this->duration_minutes,
            'difficulty_level' => $this->difficulty_level,
            'learning_objectives' => $this->learning_objectives ?? [],
            'prerequisites' => $this->prerequisites ?? [],
            'seo' => [
                'title' => $this->seo_title,
                'description' => $this->seo_description,
                'keywords' => $this->seo_keywords ?? [],
            ],
            'is_featured' => (bool) $this->is_featured,
            'published_at' => $this->published_at,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category?->id,
                'name' => $this->category?->name,
                'slug' => $this->category?->slug,
            ]),
            'certificate_template' => $this->whenLoaded('certificateTemplate', fn () => [
                'id' => $this->certificateTemplate?->id,
                'name' => $this->certificateTemplate?->name,
            ]),
            'sections_count' => $this->whenCounted('sections'),
            'lessons_count' => $this->whenCounted('lessons'),
            'enrollments_count' => $this->whenCounted('enrollments'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
