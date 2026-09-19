<?php

namespace App\Console\Commands;

use App\Models\Message;
use App\Models\WhatsAppNumber;
use App\Services\WhatsAppCloudService;
use Illuminate\Console\Command;

class FetchWhatsappMediaCommand extends Command
{
    protected $signature = 'whatsapp:fetch-media';

    protected $description = 'Récupère depuis Meta les médias reçus (vocaux, images…) restés en texte « [audio: id] ».';

    public function handle(WhatsAppCloudService $wa): int
    {
        $ok = 0;
        $failed = 0;

        Message::query()
            ->with('conversation')
            ->where('direction', 'inbound')
            ->whereNull('media_url')
            ->whereIn('message_type', WhatsAppCloudService::MEDIA_TYPES)
            ->where('content', 'like', '[%: %]')
            ->chunkById(100, function ($messages) use ($wa, &$ok, &$failed) {
                foreach ($messages as $m) {
                    if (! $m->conversation || ! preg_match('/^\[\w+: (\d+)\]$/', (string) $m->content, $match)) {
                        continue;
                    }
                    $number = $m->conversation->whatsapp_number_id ? WhatsAppNumber::find($m->conversation->whatsapp_number_id) : null;
                    $url = $wa->downloadMedia($m->conversation->brand_id, $number, $match[1], $m->conversation_id);
                    if ($url) {
                        $m->forceFill(['media_url' => $url, 'content' => null])->save();
                        $ok++;
                    } else {
                        $failed++;
                    }
                }
            });

        $this->info("Médias récupérés : {$ok} · introuvables/expirés : {$failed}");

        return self::SUCCESS;
    }
}
