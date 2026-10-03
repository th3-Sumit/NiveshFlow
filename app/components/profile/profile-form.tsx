"use client";

import {
  Camera,
  Crop,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Save,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { updateProfileAction } from "@/app/actions/auth";
import type { UserSafe } from "@/app/lib/data";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { HelpCenterTrigger } from "@/app/components/support/help-center-trigger";

function drawCropPreview({
  canvas,
  image,
  offsetX,
  offsetY,
  zoom,
}: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  zoom: number;
}) {
  const size = 512;
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const maxX = Math.max((image.naturalWidth - cropSize) / 2, 0);
  const maxY = Math.max((image.naturalHeight - cropSize) / 2, 0);
  const cropX =
    (image.naturalWidth - cropSize) / 2 + (offsetX / 100) * maxX;
  const cropY =
    (image.naturalHeight - cropSize) / 2 + (offsetY / 100) * maxY;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);
  context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, size, size);
}

function CroppedAvatarPicker({
  currentAvatarUrl,
  onChange,
  onError,
}: {
  currentAvatarUrl?: string;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl ?? "");
  const [fileName, setFileName] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [zoom, setZoom] = useState(1.15);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    if (!sourceUrl) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      sourceImageRef.current = image;
      if (canvasRef.current) {
        drawCropPreview({
          canvas: canvasRef.current,
          image,
          offsetX,
          offsetY,
          zoom,
        });
      }
    };
    image.src = sourceUrl;
  }, [sourceUrl, zoom, offsetX, offsetY]);

  useEffect(() => {
    const image = sourceImageRef.current;

    if (image && canvasRef.current) {
      drawCropPreview({
        canvas: canvasRef.current,
        image,
        offsetX,
        offsetY,
        zoom,
      });
    }
  }, [zoom, offsetX, offsetY]);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      onError("Choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onError("Choose an image smaller than 5MB.");
      return;
    }

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }

    setFileName(file.name);
    setZoom(1.15);
    setOffsetX(0);
    setOffsetY(0);
    setSourceUrl(URL.createObjectURL(file));
    setCropOpen(true);
  }

  async function applyCrop() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    if (!blob) {
      onError("Could not crop the selected image.");
      return;
    }

    const croppedFile = new File([blob], "profile-image.jpg", {
      type: "image/jpeg",
    });
    const nextPreviewUrl = URL.createObjectURL(croppedFile);

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(nextPreviewUrl);
    onChange(croppedFile);
    setCropOpen(false);
  }

  return (
    <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-4">
      <input
        accept="image/*"
        className="sr-only"
        onChange={(event) => chooseFile(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      <Label>Profile photo</Label>
      <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[64px_minmax(0,1fr)_auto]">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-primary sm:size-16">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Profile preview"
              className="size-full object-cover"
              src={previewUrl}
            />
          ) : (
            <Camera size={24} />
          )}
        </span>
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-800">
            {fileName || "Update your photo"}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Choose an image up to 5 MB.
          </p>
        </div>
        <Button className="col-span-2 w-full sm:col-span-1 sm:w-auto" onClick={() => inputRef.current?.click()} type="button" variant="outline">
          <Upload size={16} />
          Choose image
        </Button>
      </div>

      {cropOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-5 backdrop-blur-md">
          <Card role="dialog" aria-modal="true" aria-label="Crop profile image" className="scrollbar-none max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-white p-0 shadow-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-0">
              <div>
                <p className="text-sm font-bold uppercase text-emerald-600">
                  Crop profile image
                </p>
                <CardTitle className="mt-1 text-2xl">
                  Preview before upload
                </CardTitle>
              </div>
              <Button
                aria-label="Close crop dialog"
                onClick={() => setCropOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X size={18} />
              </Button>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
                <div className="grid place-items-center">
                  <canvas
                    className="size-[220px] rounded-full border-8 border-slate-100 bg-slate-100 object-cover shadow-inner"
                    ref={canvasRef}
                  />
                </div>
                <div className="grid content-center gap-4">
                  <Label className="grid gap-2">
                    Zoom
                    <input
                      className="accent-teal-600"
                      max="3"
                      min="1"
                      onChange={(event) => setZoom(Number(event.target.value))}
                      step="0.05"
                      type="range"
                      value={zoom}
                    />
                  </Label>
                  <Label className="grid gap-2">
                    Horizontal position
                    <input
                      className="accent-teal-600"
                      max="100"
                      min="-100"
                      onChange={(event) => setOffsetX(Number(event.target.value))}
                      type="range"
                      value={offsetX}
                    />
                  </Label>
                  <Label className="grid gap-2">
                    Vertical position
                    <input
                      className="accent-teal-600"
                      max="100"
                      min="-100"
                      onChange={(event) => setOffsetY(Number(event.target.value))}
                      type="range"
                      value={offsetY}
                    />
                  </Label>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() => inputRef.current?.click()}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  Pick another
                </Button>
                <Button
                  className="flex-1"
                  onClick={applyCrop}
                  size="lg"
                  type="button"
                >
                  <Crop size={17} />
                  Use cropped image
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export function ProfileForm({
  error,
  updated,
  user,
}: {
  error?: string;
  updated?: boolean;
  user: UserSafe;
}) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (avatarFile) {
      formData.set("avatar", avatarFile);
    }

    setLocalError("");
    startTransition(async () => {
      await updateProfileAction(formData);
    });
  }

  return (
    <Card className="p-0">
      <CardHeader className="p-6 pb-0">
        <CardTitle>Update profile information</CardTitle>
        <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-500">
          Keep your name, contact details, and photo up to date.
        </p>
      </CardHeader>
      <CardContent className="p-6">
        {updated ? (
          <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            Profile updated successfully.
          </p>
        ) : null}
        {error || localError ? (
          <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {localError || error}
          </p>
        ) : null}

        <form className="grid gap-5" onSubmit={submitProfile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <UserRound
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <Input
                  className="pl-12"
                  defaultValue={user.name}
                  id="name"
                  name="name"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <Input
                  className="pl-12"
                  defaultValue={user.phone}
                  id="phone"
                  name="phone"
                  required
                  type="tel"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <Input className="bg-slate-50 pl-12 pr-10 text-slate-500" defaultValue={user.email} id="email" readOnly type="email" aria-describedby="email-help" />
              <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            </div>
            <HelpCenterTrigger id="email-help" className="mt-1 h-auto justify-start px-0 py-2 text-xs" variant="ghost" subject="Email change request">Request an email change</HelpCenterTrigger>
          </div>

          <CroppedAvatarPicker
            currentAvatarUrl={user.avatarUrl}
            onChange={setAvatarFile}
            onError={setLocalError}
          />

          <Button className="w-full sm:w-fit" disabled={isPending} type="submit">
            {isPending ? <Loader2 className="animate-spin" /> : <Save size={17} />}
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
