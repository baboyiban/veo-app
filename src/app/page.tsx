"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StartResp = { name: string; done: boolean } | { error: string };

type StatusResp = { done: boolean; fileUri?: string; raw?: any; error?: any } | { error: string };

export default function HomePage() {
  const [prompt, setPrompt] = useState(
    "실제처럼 생생하게 만들어줘"
  );
  const [negative, setNegative] = useState("");
  const [aspect, setAspect] = useState("16:9");
  const [fast, setFast] = useState(false);
  const [model, setModel] = useState<"veo-2" | "veo-3">("veo-2");
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [generateAudio, setGenerateAudio] = useState<boolean>(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFileRef, setImageFileRef] = useState<string | undefined>();

  const [opName, setOpName] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [lastFileUri, setLastFileUri] = useState<string | null>(null);
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
        model,
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
  }, [prompt, negative, aspect, imageFile, imageFileRef, uploadImage, fast, model]);

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
      
      // Check for operation-level errors (like content policy violations)
      if (data.error) {
        const errorMsg = data.error.message || "Unknown operation error";
        const isContentFiltered = errorMsg.includes("filtered out") || errorMsg.includes("violated") || errorMsg.includes("Responsible AI");
        const isPromptRejected = errorMsg.includes("usage guidelines") || errorMsg.includes("could not be submitted");
        
        if (isContentFiltered) {
          setStatus("생성 완료되었지만 콘텐츠 필터링됨");
        } else if (isPromptRejected) {
          setStatus("프롬프트 거부됨");
        } else {
          setStatus(`생성 실패: ${errorMsg}`);
        }
        setIsLoading(false);
        return;
      }
      
      if (data.done) {
        setStatus("완료✅");
        setIsLoading(false);
        if (data.fileUri) {
          setLastFileUri(data.fileUri);
          console.log("Attempting download with fileUri:", data.fileUri);
          const dl = await fetch(`/api/video/download?fileUri=${encodeURIComponent(data.fileUri)}`);
          if (dl.ok) {
            const blob = await dl.blob();
            console.log("Download successful, blob size:", blob.size);
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
          } else {
            console.error("Download failed:", dl.status, await dl.text());
            setStatus("다운로드 실패");
          }
        } else {
          console.warn("Operation done but no fileUri:", data);
          setStatus("완료됐지만 파일 URI가 없음");
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
          <h1 style={{ margin: 0 }}>Veo 비디오 생성</h1>
          <span className="badge">{durationSeconds}s {generateAudio ? "+ 오디오" : "(무음)"}</span>
        </div>
        <p className="small">모델: {model === "veo-2" ? (fast ? "veo-2.0-fast-generate-001" : "veo-2.0-generate-001") : (fast ? "veo-3.0-fast-generate-preview" : "veo-3.0-generate-preview")}</p>
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
                <label>모델 버전</label>
                <select value={model} onChange={(e) => setModel(e.target.value as "veo-2" | "veo-3")}>
                  <option value="veo-3">Veo 3 (최신)</option>
                  <option value="veo-2">Veo 2</option>
                </select>
              </div>
              <div className="col">
                <label>가로세로비</label>
                <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                  <option value="16:9">16:9 (지금은 고정)</option>
                </select>
              </div>
            </div>

            <div style={{ height: 12 }} />
            <div className="row">
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
                  Fast 프리뷰 ({model === "veo-2" ? "veo-2.0-fast" : "veo-3.0-fast"})
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
            {opName && (
              <div style={{ marginTop: 8 }} className="small">
                바로 저장: <a href={`/api/video/wait?name=${encodeURIComponent(opName)}`} target="_blank" rel="noreferrer">완료되면 즉시 다운로드</a>
              </div>
            )}
            <div style={{ height: 8 }} />
            <div className="small">상태: {status}</div>
            {(status.includes("생성 실패") || status.includes("프롬프트 거부됨")) && (
              <div style={{ marginTop: 8, padding: 8, backgroundColor: "#ffebee", borderRadius: 4 }}>
                <div className="small" style={{ color: "#c62828" }}>
                  💡 <strong>프롬프트 가이드라인 위반:</strong> 프롬프트에 부적절한 내용이 포함되어 있을 수 있습니다. 
                  다른 표현으로 다시 시도해보세요.
                </div>
              </div>
            )}
            {status.includes("콘텐츠 필터링됨") && (
              <div style={{ marginTop: 8, padding: 8, backgroundColor: "#fff3e0", borderRadius: 4 }}>
                <div className="small" style={{ color: "#f57c00" }}>
                  🔍 <strong>결과물 필터링:</strong> 비디오가 생성되었지만 AI 윤리 정책에 따라 차단되었습니다.<br/>
                  • 더 구체적이고 명확한 표현 사용<br/>
                  • 폭력적, 성적, 위험한 내용 피하기<br/>
                  • 실제 인물명 대신 일반적인 설명 사용
                </div>
              </div>
            )}
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
            {lastFileUri && (
              <div style={{ marginTop: 8 }}>
                <div className="small">원본 파일 식별자: <code>{lastFileUri}</code></div>
                <div className="small">
                  직접 저장: <a href={`/api/video/download?fileUri=${encodeURIComponent(lastFileUri)}`} target="_blank" rel="noreferrer">다운로드 링크 열기</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
