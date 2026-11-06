import { ArrowUpRight, BookOpen, Check, FileText } from "lucide-react";

/** Decorative explanation of the document → evidence → next step flow. */
export function KnowledgeScene() {
  return (
    <div className="knowledge-scene" aria-hidden="true">
      <div className="scene-grid" />
      <span className="scene-label">CONHECIMENTO EM MOVIMENTO</span>
      <svg className="scene-route" viewBox="0 0 360 310" fill="none">
        <path
          className="route-track"
          d="M78 96H166Q185 96 185 115V181Q185 200 204 200H285"
        />
        <path
          className="route-draw"
          pathLength="1"
          d="M78 96H166Q185 96 185 115V181Q185 200 204 200H285"
        />
        <circle className="route-node" cx="185" cy="150" r="5" />
      </svg>
      <div className="scene-document scene-document-back">
        <FileText size={20} />
        <span className="document-line" />
        <span className="document-line short" />
      </div>
      <div className="scene-document scene-document-front">
        <span className="scene-file">
          <FileText size={19} />
        </span>
        <span className="scene-card-caption">SUA BASE DE CONHECIMENTO</span>
        <strong>
          O que sua
          <br />
          equipe sabe.
        </strong>
        <span className="document-line" />
        <span className="document-line short" />
        <span className="scene-document-foot">
          <span /> Documentos conectados
        </span>
      </div>
      <div className="scene-evidence">
        <span className="scene-evidence-icon">
          <BookOpen size={17} />
        </span>
        <div>
          <strong>Orientação com fontes</strong>
          <span>Clareza em cada etapa</span>
        </div>
        <ArrowUpRight size={15} />
      </div>
      <div className="scene-resolution">
        <span>
          <Check size={18} />
        </span>
        <div>
          <span>DO CONHECIMENTO À AÇÃO</span>
          <strong>Um próximo passo.</strong>
        </div>
      </div>
      <span className="scene-index">
        01 — 03 <span>KnowFlow AI</span>
      </span>
    </div>
  );
}
