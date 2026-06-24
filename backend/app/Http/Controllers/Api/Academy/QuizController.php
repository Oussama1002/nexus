<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Quiz;
use App\Models\QuizAnswer;
use App\Models\QuizQuestion;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuizController extends Controller
{
    public function index(Request $request, string $courseId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.view')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $quizzes = $course->quizzes()
            ->withCount(['questions', 'attempts'])
            ->orderByDesc('id')
            ->get();

        return ApiResponse::success([
            'data' => $quizzes->toArray(),
        ], 'Quizzes retrieved successfully.');
    }

    public function store(Request $request, string $courseId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'course_section_id' => 'nullable|integer|exists:course_sections,id',
            'course_lesson_id' => 'nullable|integer|exists:course_lessons,id',
            'passing_score' => 'nullable|numeric|min:0|max:100',
            'time_limit_minutes' => 'nullable|integer|min:0',
            'max_attempts' => 'nullable|integer|min:1',
            'auto_correction' => 'nullable|boolean',
            'randomized_questions' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'questions' => 'nullable|array',
            'questions.*.question_type' => 'required_with:questions|string|in:multiple_choice,multiple_answers,true_false,short_answer',
            'questions.*.question_text' => 'required_with:questions|string',
            'questions.*.points' => 'nullable|numeric|min:0',
            'questions.*.sort_order' => 'nullable|integer|min:0',
            'questions.*.answers' => 'nullable|array',
            'questions.*.answers.*.answer_text' => 'required_with:questions.*.answers|string',
            'questions.*.answers.*.is_correct' => 'nullable|boolean',
            'questions.*.answers.*.sort_order' => 'nullable|integer|min:0',
        ]);

        $quiz = DB::transaction(function () use ($validated, $course, $user) {
            $quiz = Quiz::query()->create([
                'course_id' => $course->id,
                'course_section_id' => $validated['course_section_id'] ?? null,
                'course_lesson_id' => $validated['course_lesson_id'] ?? null,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'passing_score' => $validated['passing_score'] ?? 70,
                'time_limit_minutes' => $validated['time_limit_minutes'] ?? null,
                'max_attempts' => $validated['max_attempts'] ?? null,
                'auto_correction' => $validated['auto_correction'] ?? true,
                'randomized_questions' => $validated['randomized_questions'] ?? false,
                'is_active' => $validated['is_active'] ?? true,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            if (!empty($validated['questions'])) {
                foreach ($validated['questions'] as $qIndex => $questionData) {
                    $question = QuizQuestion::query()->create([
                        'quiz_id' => $quiz->id,
                        'question_type' => $questionData['question_type'],
                        'question_text' => $questionData['question_text'],
                        'points' => $questionData['points'] ?? 1,
                        'sort_order' => $questionData['sort_order'] ?? ($qIndex + 1),
                        'created_by' => $user->id,
                        'updated_by' => $user->id,
                    ]);

                    if (!empty($questionData['answers'])) {
                        foreach ($questionData['answers'] as $aIndex => $answerData) {
                            QuizAnswer::query()->create([
                                'quiz_question_id' => $question->id,
                                'answer_text' => $answerData['answer_text'],
                                'is_correct' => $answerData['is_correct'] ?? false,
                                'sort_order' => $answerData['sort_order'] ?? ($aIndex + 1),
                                'created_by' => $user->id,
                                'updated_by' => $user->id,
                            ]);
                        }
                    }
                }
            }

            return $quiz;
        });

        return ApiResponse::success(
            $quiz->load(['questions.answers'])->toArray(),
            'Quiz created successfully.',
            201
        );
    }

    public function show(Request $request, string $courseId, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.view')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $quiz = Quiz::query()
            ->where('course_id', $course->id)
            ->with([
                'questions' => fn ($q) => $q->orderBy('sort_order'),
                'questions.answers' => fn ($q) => $q->orderBy('sort_order'),
            ])
            ->withCount(['questions', 'attempts'])
            ->findOrFail($id);

        return ApiResponse::success($quiz->toArray(), 'Quiz retrieved successfully.');
    }

    public function update(Request $request, string $courseId, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $quiz = Quiz::query()
            ->where('course_id', $course->id)
            ->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'course_section_id' => 'nullable|integer|exists:course_sections,id',
            'course_lesson_id' => 'nullable|integer|exists:course_lessons,id',
            'passing_score' => 'nullable|numeric|min:0|max:100',
            'time_limit_minutes' => 'nullable|integer|min:0',
            'max_attempts' => 'nullable|integer|min:1',
            'auto_correction' => 'nullable|boolean',
            'randomized_questions' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'questions' => 'nullable|array',
            'questions.*.id' => 'nullable|integer',
            'questions.*.question_type' => 'required_with:questions|string|in:multiple_choice,multiple_answers,true_false,short_answer',
            'questions.*.question_text' => 'required_with:questions|string',
            'questions.*.points' => 'nullable|numeric|min:0',
            'questions.*.sort_order' => 'nullable|integer|min:0',
            'questions.*.answers' => 'nullable|array',
            'questions.*.answers.*.id' => 'nullable|integer',
            'questions.*.answers.*.answer_text' => 'required_with:questions.*.answers|string',
            'questions.*.answers.*.is_correct' => 'nullable|boolean',
            'questions.*.answers.*.sort_order' => 'nullable|integer|min:0',
        ]);

        DB::transaction(function () use ($quiz, $validated, $user) {
            $quizFields = collect($validated)->except('questions')->toArray();
            $quizFields['updated_by'] = $user->id;
            $quiz->fill($quizFields);
            $quiz->save();

            if (array_key_exists('questions', $validated)) {
                $incomingQuestionIds = collect($validated['questions'] ?? [])
                    ->pluck('id')
                    ->filter()
                    ->all();

                // Delete removed questions
                $quiz->questions()
                    ->whereNotIn('id', $incomingQuestionIds)
                    ->each(function ($question) {
                        $question->answers()->delete();
                        $question->delete();
                    });

                foreach ($validated['questions'] ?? [] as $qIndex => $questionData) {
                    $questionAttrs = [
                        'quiz_id' => $quiz->id,
                        'question_type' => $questionData['question_type'],
                        'question_text' => $questionData['question_text'],
                        'points' => $questionData['points'] ?? 1,
                        'sort_order' => $questionData['sort_order'] ?? ($qIndex + 1),
                        'updated_by' => $user->id,
                    ];

                    if (!empty($questionData['id'])) {
                        $question = QuizQuestion::query()->findOrFail($questionData['id']);
                        $question->fill($questionAttrs);
                        $question->save();
                    } else {
                        $questionAttrs['created_by'] = $user->id;
                        $question = QuizQuestion::query()->create($questionAttrs);
                    }

                    if (array_key_exists('answers', $questionData)) {
                        $incomingAnswerIds = collect($questionData['answers'] ?? [])
                            ->pluck('id')
                            ->filter()
                            ->all();

                        $question->answers()
                            ->whereNotIn('id', $incomingAnswerIds)
                            ->delete();

                        foreach ($questionData['answers'] ?? [] as $aIndex => $answerData) {
                            $answerAttrs = [
                                'quiz_question_id' => $question->id,
                                'answer_text' => $answerData['answer_text'],
                                'is_correct' => $answerData['is_correct'] ?? false,
                                'sort_order' => $answerData['sort_order'] ?? ($aIndex + 1),
                                'updated_by' => $user->id,
                            ];

                            if (!empty($answerData['id'])) {
                                $answer = QuizAnswer::query()->findOrFail($answerData['id']);
                                $answer->fill($answerAttrs);
                                $answer->save();
                            } else {
                                $answerAttrs['created_by'] = $user->id;
                                QuizAnswer::query()->create($answerAttrs);
                            }
                        }
                    }
                }
            }
        });

        return ApiResponse::success(
            $quiz->fresh(['questions.answers'])->toArray(),
            'Quiz updated successfully.'
        );
    }

    public function destroy(Request $request, string $courseId, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $quiz = Quiz::query()
            ->where('course_id', $course->id)
            ->findOrFail($id);

        $quiz->updated_by = $user->id;
        $quiz->save();
        $quiz->delete();

        return ApiResponse::success(null, 'Quiz deleted successfully.');
    }
}
