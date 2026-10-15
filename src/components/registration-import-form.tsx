"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";

type ImportIssue = {
  row: number;
  field: string;
  message: string;
};

type ImportResult = {
  importId: string;
  fileName: string;
  processed: number;
  inserted: number;
  updated: number;
  eventCount: number;
  warnings: string[];
};

const acceptedFormats = ".numbers,.csv,.xls,.xlsx,.xlsl,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RegistrationImportForm() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setError(null);
    setIssues([]);
    setResult(null);
    setNeedsLogin(false);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Selecione uma planilha de inscrições antes de continuar.");
      return;
    }

    setIsImporting(true);
    setError(null);
    setIssues([]);
    setResult(null);
    setNeedsLogin(false);

    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/imports/registrations", { method: "POST", body: data });
      const payload = await response.json() as ImportResult & { error?: string; issues?: ImportIssue[] };

      if (!response.ok) {
        setError(payload.error ?? "Não foi possível importar o arquivo.");
        setIssues(payload.issues ?? []);
        setNeedsLogin(response.status === 401);
        return;
      }

      setResult(payload);
    } catch {
      setError("Não foi possível conectar ao serviço de importação. Tente novamente.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="import-layout">
      <form className="registration-import-card" onSubmit={importFile}>
        <div className="import-card-heading">
          <span className="import-icon" aria-hidden="true">↥</span>
          <div>
            <p className="section-kicker">Base de inscrições</p>
            <h2>Importar planilha do evento</h2>
            <p>O arquivo é validado antes de atualizar os dados do dashboard.</p>
          </div>
        </div>

        <input ref={fileInput} className="visually-hidden" type="file" accept={acceptedFormats} onChange={onFileChange} />
        <button className="registration-dropzone" type="button" onClick={() => fileInput.current?.click()}>
          <span className="registration-dropzone-icon">⌁</span>
          <strong>{file ? file.name : "Selecione uma planilha"}</strong>
          <small>{file ? fileSize(file.size) : "Compatível com Apple Numbers, CSV, XLS e XLSX"}</small>
          <em>{file ? "Trocar arquivo" : "Selecionar arquivo"}</em>
        </button>

        {file && <div className="selected-file"><span>Arquivo selecionado</span><strong>{file.name}</strong><button type="button" onClick={() => { selectFile(null); if (fileInput.current) fileInput.current.value = ""; }}>Remover</button></div>}

        <div className="import-actions">
          <p>Limite de 15 MB. Uma nova importação atualiza a inscrição quando a etapa e o ID já existirem.</p>
          <button className="primary-button" type="submit" disabled={isImporting}>{isImporting ? "Importando…" : "Validar e importar inscrições"}</button>
        </div>
      </form>

      <aside className="import-guidance" aria-label="Orientações para a importação">
        <p className="section-kicker">Formato esperado</p>
        <h2>Colunas obrigatórias</h2>
        <div className="column-chips">
          {["ano", "etapa_origem", "id_inscricao", "data_inscricao", "valor_final", "situacao_inscricao", "situacao_compra"].map((column) => <code key={column}>{column}</code>)}
        </div>
        <p>Campos analíticos adicionais, como lote, kit, cidade, percurso e UTM, também são importados. A data de nascimento gera apenas uma faixa etária; nome, CPF, e-mail, telefone e campos não reconhecidos são ignorados.</p>
        <div className="import-guidance-note"><b>Datas</b><span>Use o formato 14/10/2026. Para credenciamento, use 14/10/2026 08:30.</span></div>
      </aside>

      {error && <section className="import-feedback error" role="alert"><strong>{needsLogin ? "Acesso necessário" : "Revise o arquivo"}</strong><p>{error}</p>{needsLogin && <Link className="login-link" href="/login">Ir para o login</Link>}{issues.length > 0 && <ul>{issues.slice(0, 8).map((issue, index) => <li key={`${issue.row}-${issue.field}-${index}`}>Linha {issue.row}: <code>{issue.field}</code> — {issue.message}</li>)}</ul>}</section>}

      {result && <section className="import-feedback success" aria-live="polite"><strong>Importação concluída</strong><p><b>{result.processed}</b> inscrições processadas em <b>{result.eventCount}</b> etapa(s): <b>{result.inserted}</b> novas e <b>{result.updated}</b> atualizadas.</p>{result.warnings.map((warning) => <small key={warning}>{warning}</small>)}</section>}
    </div>
  );
}
