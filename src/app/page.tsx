"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StartResp = { name: string; done: boolean } | { error: string };

type StatusResp = { done: boolean; fileUri?: string; raw?: any } | { error: string };

export default function HomePage() {
  const [prompt, setPrompt] = useState(
    "살아있는 것 처럼 만들어줘"
  );
  const [negative, setNegative] = useState("");
  const [aspect, setAspect] = useState("16:9");
  const [fast, setFast] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [generateAudio, setGenerateAudio] = useState<boolean>(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFileRef, setImageFileRef] = useState<string | undefined>();

  const [opName, setOpName] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canStart = useMemo(() => prompt.trim().length > 0 && !isLoading, [prompt, isLoading]);

  const uploadImage = useCallback(async () => {
    if (!imageFile) return undefined;
    const form = new FormData();
    form.append("file", imageFile);
    const res = await fetch("/api/files/upload", { method: "POST", body: form });
    const data = await res.json();
    if (data?.file?.name) {
      // name is like files/{id}
      const id = String(data.file.name).split("/").pop();
      setImageFileRef(id);
      return id;
    }
    return undefined;
  }, [imageFile]);

  const start = useCallback(async () => {
    setIsLoading(true);
    setStatus("시작 중...");
    setVideoUrl(null);

    let imageFileId: string | undefined = imageFileRef;
    if (imageFile && !imageFileId) {
      imageFileId = await uploadImage();
    }

    const res = await fetch("/api/video/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        negativePrompt: negative || undefined,
        aspectRatio: aspect,
        imageFileId,
  fast,
      }),
    });
    const data: StartResp = await res.json();
    if ("error" in data) {
      setIsLoading(false);
      setStatus(`에러: ${data.error}`);
      return;
    }
    setOpName(data.name);
    setStatus("생성 중...");
  }, [prompt, negative, aspect, imageFile, imageFileRef, uploadImage, fast]);

  // Polling
  useEffect(() => {
    if (!opName) return;
    let t: any;
    const poll = async () => {
      const res = await fetch(`/api/video/status?name=${encodeURIComponent(opName!)}`);
      const data: StatusResp = await res.json();
      if ("error" in data) {
        setStatus(`에러: ${data.error}`);
        setIsLoading(false);
        return;
      }
      if (data.done) {
        setStatus("완료✅");
        setIsLoading(false);
        if (data.fileUri) {
          const dl = await fetch(`/api/video/download?fileUri=${encodeURIComponent(data.fileUri)}`);
          if (dl.ok) {
            const blob = await dl.blob();
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
          } else {
            setStatus("다운로드 실패");
          }
        }
      } else {
        setStatus("생성 중...(10초 주기)");
        t = setTimeout(poll, 10_000);
      }
    };
    poll();
    return () => clearTimeout(t);
  }, [opName]);

  return (
    <main className="container">
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>Veo 3 비디오 생성</h1>
          <span className="badge">{durationSeconds}s {generateAudio ? "+ 오디오" : "(무음)"}</span>
        </div>
        <p className="small">모델: {fast ? "veo-3.0-fast-generate-preview" : "veo-3.0-generate-preview"}</p>
      </div>

      <div className="row">
        <div className="col">
          <div className="card">
            <label>프롬프트</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />

            <div style={{ height: 12 }} />
            <label>네거티브 프롬프트 (선택)</label>
            <input type="text" value={negative} onChange={(e) => setNegative(e.target.value)} />

            <div style={{ height: 12 }} />
            <div className="row">
              <div className="col">
                <label>가로세로비</label>
                <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                  <option value="16:9">16:9 (지금은 고정)</option>
                </select>
              </div>
              <div className="col">
                <label>길이(초)</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value) || 8)}
                />
              </div>
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <div className="col" style={{ display: "flex", alignItems: "end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={generateAudio} onChange={(e) => setGenerateAudio(e.target.checked)} />
                  오디오 생성
                </label>
              </div>
              <div className="col" style={{ display: "flex", alignItems: "end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
                  Fast 프리뷰 (veo-3.0-fast)
                </label>
              </div>
            </div>

            <div style={{ height: 12 }} />
            <label>시작 이미지 (선택, Image→Video)</label>
            <div className="file-drop">
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              <div className="small">선택 시 첫 프레임으로 사용됩니다.</div>
            </div>

            <div style={{ height: 12 }} />
            <button onClick={start} disabled={!canStart}>{isLoading ? "생성 중..." : "비디오 생성"}</button>
            <div style={{ height: 8 }} />
            <div className="small">상태: {status}</div>
          </div>
        </div>

        <div className="col">
          <div className="card">
            <label>결과</label>
            {videoUrl ? (
              <video className="video" controls src={videoUrl} />
            ) : (
              <div className="file-drop">아직 생성된 비디오가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
