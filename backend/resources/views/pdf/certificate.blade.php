<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Certificat</title>
    <style>
        @page { margin: 0; size: A4 landscape; }
        * { box-sizing: border-box; font-family: DejaVu Sans, sans-serif; }
        body { margin: 0; padding: 0; }
        .frame {
            width: 100%;
            height: 100vh;
            padding: 40px 60px;
            background: #ffffff;
            border: 14px solid #0f172a;
            position: relative;
        }
        .inner {
            width: 100%;
            height: 100%;
            border: 2px solid #94a3b8;
            padding: 40px 60px;
            text-align: center;
        }
        .brand { font-size: 14px; letter-spacing: 6px; color: #475569; text-transform: uppercase; margin-top: 6px; }
        .title { font-size: 42px; font-weight: bold; color: #0f172a; margin: 30px 0 10px; letter-spacing: 2px; }
        .subtitle { font-size: 14px; color: #475569; margin-bottom: 36px; }
        .to { font-size: 15px; color: #475569; }
        .name { font-size: 34px; font-weight: bold; color: #0f172a; margin: 10px 0 24px; }
        .for { font-size: 15px; color: #475569; margin-bottom: 10px; }
        .course { font-size: 22px; font-weight: bold; color: #0f172a; margin-bottom: 36px; }
        .meta {
            margin-top: 60px;
            width: 100%;
            font-size: 11px;
            color: #475569;
        }
        .meta td { padding-top: 8px; }
        .meta .label { text-transform: uppercase; letter-spacing: 2px; font-size: 10px; color: #94a3b8; display: block; margin-bottom: 2px; }
        .meta .value { font-weight: bold; color: #0f172a; }
        .num { font-family: DejaVu Sans Mono, monospace; }
    </style>
</head>
<body>
    <div class="frame">
        <div class="inner">
            <div class="brand">{{ $brand_name ?? 'Brandna' }}</div>
            <div class="title">CERTIFICAT</div>
            <div class="subtitle">D'ACHÈVEMENT DE FORMATION</div>

            <div class="to">Décerné à</div>
            <div class="name">{{ $student_name }}</div>

            <div class="for">Pour avoir complété avec succès la formation</div>
            <div class="course">« {{ $course_title }} »</div>

            <table class="meta">
                <tr>
                    <td style="width: 33%; text-align: left;">
                        <span class="label">Date de délivrance</span>
                        <span class="value">{{ $issued_at }}</span>
                    </td>
                    <td style="width: 33%; text-align: center;">
                        <span class="label">N° de certificat</span>
                        <span class="value num">{{ $certificate_number }}</span>
                    </td>
                    <td style="width: 33%; text-align: right;">
                        <span class="label">Code de vérification</span>
                        <span class="value num">{{ $verification_token }}</span>
                    </td>
                </tr>
            </table>
        </div>
    </div>
</body>
</html>
