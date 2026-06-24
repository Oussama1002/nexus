<?php

namespace App\Models;

class Certificate extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'course_id',
        'enrollment_id',
        'student_id',
        'certificate_template_id',
        'certificate_number',
        'verification_token',
        'qr_code_url',
        'pdf_path',
        'issued_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'issued_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function template()
    {
        return $this->belongsTo(CertificateTemplate::class, 'certificate_template_id');
    }
}
