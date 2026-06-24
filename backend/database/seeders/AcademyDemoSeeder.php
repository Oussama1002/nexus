<?php

namespace Database\Seeders;

use App\Models\CertificateTemplate;
use App\Models\Course;
use App\Models\CourseCategory;
use App\Models\CourseLesson;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAnswer;
use App\Models\QuizQuestion;
use App\Models\Student;
use Illuminate\Database\Seeder;

class AcademyDemoSeeder extends Seeder
{
    public function run(): void
    {
        $category = CourseCategory::factory()->create();
        $template = CertificateTemplate::factory()->create(['brand_id' => $category->brand_id]);
        $course = Course::factory()->create([
            'brand_id' => $category->brand_id,
            'course_category_id' => $category->id,
            'certificate_template_id' => $template->id,
            'status' => 'published',
            'published_at' => now(),
        ]);

        $sections = CourseSection::factory()->count(3)->create([
            'course_id' => $course->id,
            'is_published' => true,
        ]);

        foreach ($sections as $section) {
            CourseLesson::factory()->count(4)->create([
                'course_id' => $course->id,
                'course_section_id' => $section->id,
                'is_published' => true,
            ]);
        }

        $student = Student::factory()->create(['brand_id' => $course->brand_id]);
        Enrollment::factory()->create([
            'brand_id' => $course->brand_id,
            'course_id' => $course->id,
            'student_id' => $student->id,
            'status' => 'active',
            'enrollment_type' => 'free',
        ]);

        $quiz = Quiz::factory()->create(['course_id' => $course->id]);
        $question = QuizQuestion::factory()->create(['quiz_id' => $quiz->id, 'question_type' => 'multiple_choice']);
        QuizAnswer::factory()->count(4)->create(['quiz_question_id' => $question->id]);
    }
}
