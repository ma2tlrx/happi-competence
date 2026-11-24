'use client';

import { Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlays';

/** Vidéos de présentation des programmes (public/videos), à regarder sans autre action. */
export const PROGRAM_VIDEOS = {
  happi_competence: { src: '/videos/happi-competence.mp4', poster: '/videos/happi-competence.jpg', title: 'HAPPI Compétence en vidéo' },
  passeport_numerique: { src: '/videos/passeport-numerique.mp4', poster: '/videos/passeport-numerique.jpg', title: 'Passeport Numérique en vidéo' },
} as const;

/** Bouton « Voir la vidéo » : ouvre la vidéo de présentation du programme dans une fenêtre. */
export function ProgramVideoButton({ kind }: { kind: keyof typeof PROGRAM_VIDEOS }) {
  const video = PROGRAM_VIDEOS[kind];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Play aria-hidden />
          Voir la vidéo
        </Button>
      </DialogTrigger>
      <DialogContent title={video.title} size="xl">
        <video
          controls
          autoPlay
          playsInline
          preload="metadata"
          poster={video.poster}
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onContextMenu={(event) => event.preventDefault()}
          className="aspect-video w-full rounded-md bg-petrol-950"
        >
          <source src={video.src} type="video/mp4" />
        </video>
      </DialogContent>
    </Dialog>
  );
}
