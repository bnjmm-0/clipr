"use client";
import Link from "next/link";
import { publishClip } from "@/app/actions";

export default function PublishForm({ clipId, episodeId, caption, platforms }: { clipId?: string; episodeId?: string; caption: string; platforms: { id: string; label: string }[] }) {
  if (!platforms.length) return <p className="note">Connecte d'abord un compte dans <Link href="/comptes" style={{ textDecoration: "underline" }}>Comptes et publication</Link></p>;
  return (
    <form action={publishClip}>
      {clipId && <input type="hidden" name="clipId" value={clipId} />}
      {episodeId && <input type="hidden" name="episodeId" value={episodeId} />}
      <label>Publier sur</label>
      <div className="seg">{platforms.map((p, i) => <label key={p.id}><input type="checkbox" name="platform" value={p.id} defaultChecked={i === 0} />{p.label}</label>)}</div>
      <label>Légende</label><textarea name="caption" rows={3} defaultValue={caption} />
      <label>Visibilité TikTok</label>
      <select name="privacy"><option value="SELF_ONLY">Privé (obligatoire tant que l'app TikTok n'est pas validée)</option><option value="PUBLIC_TO_EVERYONE">Public</option><option value="MUTUAL_FOLLOW_FRIENDS">Amis</option></select>
      <label>Planifier (vide = maintenant)</label><input type="datetime-local" name="scheduledAt" />
      <button className="btn sm" style={{ marginTop: 16 }}>Publier</button>
    </form>
  );
}
