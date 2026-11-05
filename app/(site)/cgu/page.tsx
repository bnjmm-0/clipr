export default function CGU() {
  return (
    <main className="wrap stack" style={{ maxWidth: 760, paddingTop: 64 }}>
      <h1>Conditions d'utilisation</h1>
      <p className="note">Modèle à faire valider par un juriste avant le lancement payant.</p>
      <h2 style={{ marginTop: 32 }}>Droits sur les vidéos importées</h2>
      <p className="sec">L'utilisateur garantit qu'il détient tous les droits nécessaires (droits d'auteur, droit à l'image, autorisations des personnes filmées) sur chaque vidéo qu'il importe ou dont il fournit le lien, ainsi que sur les clips qu'il publie. Il est seul responsable de cet usage. Une confirmation est demandée à chaque import.</p>
      <h2 style={{ marginTop: 32 }}>Signalement et retrait</h2>
      <p className="sec">Tout titulaire de droits peut signaler un contenu ; il est retiré rapidement après vérification.</p>
      <h2 style={{ marginTop: 32 }}>Liens YouTube</h2>
      <p className="sec">Le téléchargement depuis YouTube peut aller à l'encontre de ses conditions d'utilisation : l'import de fichier est la voie recommandée.</p>
      <h2 style={{ marginTop: 32 }}>Services tiers et coûts</h2>
      <p className="sec">Les traitements utilisent des API tierces (transcription, IA, TikTok) avec les clés de l'exploitant ; les coûts correspondants sont facturés par ces fournisseurs.</p>
      <h2 style={{ marginTop: 32 }}>Données personnelles</h2>
      <p className="sec">La détection de visage sert uniquement au recadrage : aucune empreinte faciale n'est stockée. Les vidéos sources peuvent être supprimées à tout moment par l'utilisateur.</p>
      <h2 style={{ marginTop: 32 }}>Vidéos reprises</h2>
      <p className="sec">La fonction « Reprendre une vidéo » analyse la structure d'une vidéo pour en écrire une version originale. Elle ne doit pas servir à copier des phrases, des images ou une œuvre protégée ; l'utilisateur reste responsable de la vidéo source qu'il fournit.</p>
      <h2 style={{ marginTop: 32 }}>Contenus générés par IA</h2>
      <p className="sec">Les images et vidéos générées par IA doivent être signalées comme telles lors de leur diffusion.</p>
    </main>
  );
}
