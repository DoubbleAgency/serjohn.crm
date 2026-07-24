'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const COMBUSTIVEIS = ['Gasolina', 'Gasóleo', 'Híbrido', 'Híbrido Plug-In', 'Elétrico', 'GPL'];
const ESTADOS = ['Disponível', 'Reservado', 'Vendido'];

/**
 * Formulário de carro + gestor de fotos.
 * Fotos novas vão para o Supabase Storage (bucket car-photos);
 * carros migrados do Notion podem ter URLs do Google Drive — funcionam na mesma.
 * A primeira foto é a capa no site.
 */
export default function CarForm({ car }) {
  const router = useRouter();
  const isNew = !car;
  const [f, setF] = useState({
    marca: car?.marca || '',
    modelo: car?.modelo || '',
    versao: car?.versao || '',
    ano: car?.ano ?? '',
    km: car?.km ?? '',
    combustivel: car?.combustivel || '',
    caixa: car?.caixa || '',
    cor: car?.cor || '',
    preco: car?.preco ?? '',
    preco_promo: car?.preco_promo ?? '',
    matricula: car?.matricula || '',
    estado: car?.estado || 'Disponível',
    destaque: car?.destaque || false,
    descricao: car?.descricao || '',
  });
  const [fotos, setFotos] = useState(Array.isArray(car?.fotos) ? car.fotos : []);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function set(k, v) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function payload() {
    return {
      ...f,
      ano: f.ano === '' ? null : Number(f.ano),
      km: f.km === '' ? null : Number(f.km),
      preco: f.preco === '' ? null : Number(f.preco),
      preco_promo: f.preco_promo === '' ? null : Number(f.preco_promo),
      combustivel: f.combustivel || null,
      caixa: f.caixa || null,
      fotos,
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    let error;
    if (isNew) {
      const r = await supabase.from('cars').insert(payload()).select('id').single();
      error = r.error;
      if (!error) {
        router.push(`/stock/${r.data.id}`);
        router.refresh();
        return;
      }
    } else {
      const r = await supabase.from('cars').update(payload()).eq('id', car.id);
      error = r.error;
    }
    if (error) setMsg({ t: 'error', m: 'Erro ao guardar: ' + error.message });
    else {
      setMsg({ t: 'ok', m: 'Guardado. O site atualiza em ~1 minuto.' });
      router.refresh();
    }
    setBusy(false);
  }

  async function onUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setMsg(null);
    const supabase = createClient();
    const novas = [];
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${car?.id || 'novo'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('car-photos').upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) {
        setMsg({ t: 'error', m: `Falhou o upload de ${file.name}: ${error.message}` });
        continue;
      }
      const { data } = supabase.storage.from('car-photos').getPublicUrl(path);
      novas.push(data.publicUrl);
    }
    const updated = [...fotos, ...novas];
    setFotos(updated);
    setUploading(false);
    // Persistir logo as fotos se o carro já existe
    if (!isNew && novas.length > 0) {
      await supabase.from('cars').update({ fotos: updated }).eq('id', car.id);
      router.refresh();
    }
    e.target.value = '';
  }

  async function saveFotos(updated) {
    setFotos(updated);
    if (!isNew) {
      const supabase = createClient();
      await supabase.from('cars').update({ fotos: updated }).eq('id', car.id);
      router.refresh();
    }
  }

  function mover(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= fotos.length) return;
    const arr = [...fotos];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    saveFotos(arr);
  }

  function capa(i) {
    const arr = [fotos[i], ...fotos.filter((_, k) => k !== i)];
    saveFotos(arr);
  }

  function apagar(i) {
    saveFotos(fotos.filter((_, k) => k !== i));
  }

  return (
    <form className="form card" onSubmit={onSubmit}>
      <div className="row three">
        <label className="field">Marca
          <input value={f.marca} onChange={(e) => set('marca', e.target.value)} required />
        </label>
        <label className="field">Modelo
          <input value={f.modelo} onChange={(e) => set('modelo', e.target.value)} required />
        </label>
        <label className="field">Versão
          <input value={f.versao} onChange={(e) => set('versao', e.target.value)} placeholder="ex: V10 Performance Spyder" />
        </label>
      </div>

      <div className="row three">
        <label className="field">Ano
          <input type="number" value={f.ano} onChange={(e) => set('ano', e.target.value)} />
        </label>
        <label className="field">Quilómetros
          <input type="number" value={f.km} onChange={(e) => set('km', e.target.value)} />
        </label>
        <label className="field">Matrícula
          <input value={f.matricula} onChange={(e) => set('matricula', e.target.value)} placeholder="AA-00-AA" />
        </label>
      </div>

      <div className="row three">
        <label className="field">Combustível
          <select value={f.combustivel} onChange={(e) => set('combustivel', e.target.value)}>
            <option value="">—</option>
            {COMBUSTIVEIS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">Caixa
          <select value={f.caixa} onChange={(e) => set('caixa', e.target.value)}>
            <option value="">—</option>
            <option>Manual</option>
            <option>Automática</option>
          </select>
        </label>
        <label className="field">Cor
          <input value={f.cor} onChange={(e) => set('cor', e.target.value)} />
        </label>
      </div>

      <div className="row three">
        <label className="field">Preço (€)
          <input type="number" value={f.preco} onChange={(e) => set('preco', e.target.value)} />
        </label>
        <label className="field">Preço promo (€)
          <input type="number" value={f.preco_promo} onChange={(e) => set('preco_promo', e.target.value)} />
        </label>
        <label className="field">Estado
          <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
            {ESTADOS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <label className="check">
        <input type="checkbox" checked={f.destaque} onChange={(e) => set('destaque', e.target.checked)} />
        Carro em destaque
      </label>

      <label className="field">Descrição / extras (aparece no site)
        <textarea value={f.descricao} onChange={(e) => set('descricao', e.target.value)} />
      </label>

      <div>
        <h3 style={{ fontFamily: 'Inter Tight', fontSize: 14, marginBottom: 8 }}>
          Fotos ({fotos.length}) — a primeira é a capa
        </h3>
        <div className="photos-grid">
          {fotos.map((url, i) => (
            <div className="pitem" key={url + i}>
              {i === 0 && <span className="cover-tag">capa</span>}
              <img src={url} alt="" loading="lazy" />
              <div className="pactions">
                <button type="button" onClick={() => mover(i, -1)} title="Mover para trás">←</button>
                {i !== 0 && <button type="button" onClick={() => capa(i)} title="Tornar capa">★</button>}
                <button type="button" onClick={() => mover(i, 1)} title="Mover para a frente">→</button>
                <button type="button" onClick={() => apagar(i)} title="Remover">✕</button>
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 10 }}>
          <label className="btn secondary small" style={{ cursor: 'pointer' }}>
            {uploading ? 'A carregar…' : '+ Carregar fotos'}
            <input type="file" accept="image/*" multiple onChange={onUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
        </p>
      </div>

      {msg && <p className={msg.t === 'ok' ? 'ok-msg' : 'error-msg'}>{msg.m}</p>}
      <div>
        <button className="btn" disabled={busy || uploading}>
          {busy ? 'A guardar…' : isNew ? 'Criar carro' : 'Guardar alterações'}
        </button>
      </div>
    </form>
  );
}
