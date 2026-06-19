<script lang="ts">
  import { onMount } from 'svelte';

  // ===== 类型 =====
  interface TrackInfo {
    type: 'video' | 'audio';
    codecName: string;
    codecString: string;
    detail?: string;
    browserSupported?: boolean;
    mseSupported?: boolean;
  }

  interface ParseResult {
    container: string;
    containerDetail: string;
    fileSize: number;
    fileName: string;
    tracks: TrackInfo[];
    errors: string[];
  }

  // ===== 状态 =====
  let videoFile: File | null = $state(null);
  let videoUrl: string | null = $state(null);
  let videoEl: HTMLVideoElement | undefined = $state(undefined);
  let result: ParseResult | null = $state(null);
  let isDragging = $state(false);
  let isParsing = $state(false);
  let videoWidth = $state(0);
  let videoHeight = $state(0);
  let videoDuration = $state(0);
  let playbackOk = $state(false);
  let playbackError = $state('');

  // ===== 工具函数 =====
  const decoder = new TextDecoder();
  function r4(view: DataView, off: number) {
    return String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
  }
  function hex(view: DataView, off: number, len: number) {
    let s = '';
    for (let i = 0; i < len; i++) s += view.getUint8(off + i).toString(16).padStart(2, '0');
    return s;
  }

  // ===== MP4 解析 =====
  function parseMp4(view: DataView): { tracks: TrackInfo[]; errors: string[]; ftyp?: string } {
    const tracks: TrackInfo[] = [];
    const errors: string[] = [];
    let ftyp = '';

    // 遍历 box，支持 64 位扩展大小，跳过无效 box 继续搜索
    function eachBox(offset: number, end: number, fn: (type: string, dataOff: number, dataLen: number) => boolean) {
      while (offset <= end - 8) {
        let size = view.getUint32(offset);
        const type = r4(view, offset + 4);

        if (size === 1) {
          // 64 位扩展大小：后面 8 字节为 uint64 实际大小
          if (offset + 16 > end) break;
          const hi = view.getUint32(offset + 8);
          const lo = view.getUint32(offset + 12);
          // 超过 JS 安全整数范围则放弃（实际 mp4 文件头部几乎不会出现）
          if (hi > 0x1FFFFF) { offset += 4; continue; }
          size = hi * 0x100000000 + lo;
          if (size < 16) { offset += 4; continue; }
          if (offset + size > end) { offset += 4; continue; }
          if (!fn(type, offset + 16, size - 16)) break;
          offset += size;
        } else if (size === 0) {
          // size == 0 表示 box 延伸到文件末尾
          if (!fn(type, offset + 8, end - offset - 8)) break;
          break;
        } else {
          if (size < 8 || offset + size > end) { offset += 4; continue; }
          if (!fn(type, offset + 8, size - 8)) break;
          offset += size;
        }
      }
    }

    // ftyp
    eachBox(0, Math.min(view.byteLength, 4 * 1024 * 1024), (type, dOff, dLen) => {
      if (type === 'ftyp') {
        const major = r4(view, dOff);
        const brands: string[] = [major];
        for (let i = 8; i + 4 <= dLen; i += 4) brands.push(r4(view, dOff + i));
        ftyp = `${major} [${[...new Set(brands)].join(', ')}]`;
      }
      return true;
    });

    // 递归查找 stsd
    function findStsd(off: number, end: number): void {
      eachBox(off, end, (type, dOff, dLen) => {
        if (type === 'stsd') {
          const ver = view.getUint8(dOff);
          const count = view.getUint32(dOff + 4);
          let eOff = dOff + 8;
          for (let i = 0; i < count && eOff + 8 <= dOff + dLen; i++) {
            const eSize = view.getUint32(eOff);
            const eType = r4(view, eOff + 4);
            // SampleEntry 最少需要 16 字节（8 header + 6 reserved + 2 dref）
            if (eSize < 16 || eOff + eSize > dOff + dLen) break;
            const dataStart = eOff + 8;
            tryExtractCodec(eType, dataStart, eSize - 8, tracks, errors);
            eOff += eSize;
          }
          return false;
        }
        if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
          findStsd(dOff, dOff + dLen);
        }
        return true;
      });
    }

    findStsd(0, view.byteLength);
    return { tracks, errors, ftyp };
  }

  const MP4_VIDEO_CODECS: Record<string, string> = {
    avc1: 'H.264', avc3: 'H.264', hev1: 'H.265', hvc1: 'H.265',
    vp08: 'VP8', vp09: 'VP9', av01: 'AV1', encv: '加密视频',
  };
  const MP4_AUDIO_CODECS: Record<string, string> = {
    mp4a: 'AAC/MP4 音频', enca: '加密音频', Opus: 'Opus', fLaC: 'FLAC', ac_3: 'AC-3', ec_3: 'E-AC-3',
  };

  function tryExtractCodec(fourCC: string, off: number, len: number, tracks: TrackInfo[], errors: string[]) {
    // off 指向 SampleEntry 的 reserved[6] 开始
    // SampleEntry base = 8 bytes (reserved[6] + data_reference_index[2])

    if (MP4_VIDEO_CODECS[fourCC]) {
      let cs = fourCC;
      // VisualSampleEntry = SampleEntry(8) + visual extras(70) = 78 bytes
      if (['avc1', 'avc3', 'hev1', 'hvc1', 'vp09', 'vp08', 'av01'].includes(fourCC) && len >= 78) {
        const cfgOff = off + 78; // 跳过整个 VisualSampleEntry header
        if (cfgOff + 8 <= off + len) {
          const v = view_at(cfgOff);
          const cfgSize = v.getUint32(0);
          const cfgType = r4(v, 4);

          if (fourCC === 'av01' && cfgType === 'av1C' && cfgSize >= 12) {
            // av1C: [size:4][type:4][marker:1][version:7][seq_profile:3][seq_level:5][seq_tier:3][...]
            const b1 = v.getUint8(9);   // marker(1)|version(7)
            const b2 = v.getUint8(10);  // seq_profile(3)|seq_level_idx_0(5)
            const b3 = v.getUint8(11);  // seq_tier_0(3)|high_bitdepth(2)|...
            const profile = (b2 >> 5) & 0x07;
            const level = b2 & 0x1f;
            const tier = (b3 >> 5) & 0x07;
            const bitDepth = (b3 >> 3) & 0x03;
            const bd = bitDepth >= 2 ? 12 : bitDepth === 1 ? 10 : 8;
            cs = `av01.${profile}.${level.toString().padStart(2, '0')}${tier >= 4 ? 'H' : 'M'}.${bd.toString().padStart(2, '0')}`;
          } else if (fourCC.startsWith('avc') && cfgType === 'avcC' && cfgSize >= 12) {
            // avcC: [size:4][type:4][version:1][profile:1][compat:1][level:1]
            const profile = hex(v, 9, 1);
            const compat = hex(v, 10, 1);
            const level = hex(v, 11, 1);
            cs = `${fourCC}.${profile}${compat}${level}`;
          } else if ((fourCC === 'hev1' || fourCC === 'hvc1') && cfgType === 'hvcC' && cfgSize >= 23) {
            // hvcC: [size:4][type:4][ver:1][profile_space(2)|tier(1)|profile_idc(5):1][compat_flags:4][constraint:6][level:1]...
            const b = v.getUint8(9);
            const profileSpace = (b >> 6) & 0x03;
            const profileIdc = b & 0x3f;
            const levelIdc = v.getUint8(20);
            const ps = ['', 'A', 'B', 'C'][profileSpace];
            cs = `${fourCC}.${ps}${profileIdc}.${levelIdc.toString(16).padStart(2, '0')}.B0`;
          } else if (fourCC === 'vp09' && cfgType === 'vpcC' && cfgSize >= 12) {
            // vpcC: [size:4][type:4][profile:1][level:1][bitDepth(4)|chroma(3)|...:1]
            const profile = v.getUint8(8);
            const level = v.getUint8(9);
            const raw = v.getUint8(10);
            const bitDepth = (raw >> 4) & 0x0f;
            cs = `vp09.${profile.toString().padStart(2, '0')}.${level.toString().padStart(2, '0')}.${bitDepth.toString().padStart(2, '0')}`;
          } else {
            cs = `${fourCC}.${hex(v, 4, 4)}`;
          }
        }
      }
      tracks.push({ type: 'video', codecName: MP4_VIDEO_CODECS[fourCC], codecString: cs });
    } else if (MP4_AUDIO_CODECS[fourCC]) {
      let cs = fourCC;
      if (fourCC === 'mp4a') {
        // AudioSampleEntry = SampleEntry(8) + audio extras(20) = 28 bytes
        const innerOff = off + 28;
        if (innerOff + 8 <= off + len) {
          const v2 = view_at(innerOff);
          const innerType = r4(v2, 4);
          if (innerType === 'esds') {
            const v = view_at(innerOff + 8);
            const scanEnd = Math.min(off + len - innerOff - 8, 128);
            for (let j = 0; j < scanEnd; j++) {
              if (v.getUint8(j) === 0x04) {
                const objType = v.getUint8(j + 2);
                cs = `mp4a.40.${objType}`;
                break;
              }
            }
          }
        }
      } else if (fourCC === 'Opus' || fourCC === 'fLaC' || fourCC === 'ac_3' || fourCC === 'ec_3') {
        cs = fourCC;
      }
      tracks.push({ type: 'audio', codecName: MP4_AUDIO_CODECS[fourCC], codecString: cs });
    }
  }

  // 辅助：创建从指定偏移开始的 DataView
  function view_at(offset: number): DataView {
    return new DataView(result_buf.buffer, result_buf.byteOffset + offset);
  }
  let result_buf: DataView = undefined!;

  // ===== WebM / MKV 解析 =====
  function parseWebM(buf: ArrayBuffer): { tracks: TrackInfo[]; errors: string[] } {
    const tracks: TrackInfo[] = [];
    const errors: string[] = [];
    const scanLen = Math.min(buf.byteLength, 4 * 1024 * 1024);
    const bytes = new Uint8Array(buf, 0, scanLen);
    const str = decoder.decode(bytes);

    const VIDEO_PATTERNS: [RegExp, string, string][] = [
      [/V_VP9/, 'vp09', 'VP9'], [/V_VP8/, 'vp8', 'VP8'], [/V_AV1/, 'av01', 'AV1'],
      [/V_MPEG4\/ISO\/AVC/, 'avc1', 'H.264'], [/V_MPEGH\/ISO\/HEVC/, 'hev1', 'H.265'],
      [/V_THEORA/, 'theora', 'Theora'],
    ];
    for (const [re, cs, name] of VIDEO_PATTERNS) {
      if (re.test(str)) { tracks.push({ type: 'video', codecName: name, codecString: cs }); break; }
    }

    const AUDIO_PATTERNS: [RegExp, string, string][] = [
      [/A_OPUS/, 'opus', 'Opus'], [/A_VORBIS/, 'vorbis', 'Vorbis'],
      [/A_AAC/, 'mp4a.40.2', 'AAC'], [/A_FLAC/, 'flac', 'FLAC'],
      [/A_MPEG\/L3/, 'mp3', 'MP3'],
    ];
    for (const [re, cs, name] of AUDIO_PATTERNS) {
      if (re.test(str)) { tracks.push({ type: 'audio', codecName: name, codecString: cs }); break; }
    }

    return { tracks, errors };
  }

  // ===== Ogg 解析 =====
  function parseOgg(view: DataView): { tracks: TrackInfo[]; errors: string[] } {
    const tracks: TrackInfo[] = [];
    const errors: string[] = [];
    const scanLen = Math.min(view.byteLength, 65536);

    // Ogg page header: "OggS"(4) + version(1) + header_type(1) + granule(8) + serial(4) + seq(4) + checksum(4) + segments(1) = 27 bytes min
    for (let i = 0; i + 27 <= scanLen; i++) {
      if (r4(view, i) !== 'OggS') continue;
      // Check version == 0
      if (view.getUint8(i + 4) !== 0x00) continue;
      // Check BOS (Beginning of Stream) flag
      const hdrType = view.getUint8(i + 5);
      if ((hdrType & 0x02) === 0) continue;

      const nSegments = view.getUint8(i + 26);
      if (nSegments === 0) continue;

      // Calculate total data size from segment table
      let dataSize = 0;
      for (let s = 0; s < nSegments && i + 27 + s < scanLen; s++) {
        dataSize += view.getUint8(i + 27 + s);
      }
      if (dataSize < 4) continue;

      const dataOff = i + 27 + nSegments;
      if (dataOff + dataSize > scanLen) continue;

      // The identification header packet starts at dataOff
      const id = r4(view, dataOff);
      if (id === 'vorb' && dataSize >= 7) {
        tracks.push({ type: 'audio', codecName: 'Vorbis', codecString: 'vorbis' });
      } else if (id === 'Opus' && dataSize >= 8) {
        // "OpusHead" magic
        const magic = r4(view, dataOff + 4);
        if (magic === 'Head') {
          tracks.push({ type: 'audio', codecName: 'Opus', codecString: 'opus' });
        }
      } else if (id === 'fLaC' && dataSize >= 4) {
        tracks.push({ type: 'audio', codecName: 'FLAC', codecString: 'flac' });
      } else if (id === 'Spee' && dataSize >= 4) {
        tracks.push({ type: 'audio', codecName: 'Speex', codecString: 'speex' });
      } else if (id === 'theo' || id === '\x80the') {
        // Theora: magic + version bytes
        if (dataSize >= 7) {
          const ver = `${view.getUint8(dataOff + 4)}.${view.getUint8(dataOff + 5)}.${view.getUint8(dataOff + 6)}`;
          tracks.push({ type: 'video', codecName: 'Theora', codecString: `theora (${ver})` });
        }
      }
    }
    return { tracks, errors };
  }

  // ===== AVI 解析 =====
  function parseAvi(view: DataView): { tracks: TrackInfo[]; errors: string[] } {
    const tracks: TrackInfo[] = [];
    const errors: string[] = [];
    const scanLen = Math.min(view.byteLength, 4 * 1024 * 1024);

    function fccAt(off: number): string {
      return off + 4 > scanLen ? '' : r4(view, off);
    }
    function dwAt(off: number): number {
      return off + 4 > scanLen ? 0 : view.getUint32(off, true);
    }

    if (scanLen < 12 || fccAt(0) !== 'RIFF' || fccAt(8) !== 'AVI ') {
      errors.push('不是有效的 AVI 文件');
      return { tracks, errors };
    }

    const CODEC_MAP: Record<string, string> = {
      'DIB ': 'Uncompressed', '\x00\x00\x00\x00': 'Uncompressed',
      'MJPG': 'Motion JPEG',
      // MPEG-2 变体：MPG2/mpg2/mpeg/mpg4 等均可能出现在 AVI strh.handler 中
      'MPG2': 'MPEG-2', 'mpg2': 'MPEG-2', 'MPEG': 'MPEG-2', 'mpeg': 'MPEG-2',
      'mpg4': 'MPEG-2', 'MPG4': 'MPEG-2', 'mmpg': 'MPEG-2',
      'H264': 'H.264', 'X264': 'H.264', 'avc1': 'H.264', 'AVC1': 'H.264',
      'h264': 'H.264', 'x264': 'H.264',
      'HEVC': 'H.265', 'hvc1': 'H.265', 'H265': 'H.265',
      'hevc': 'H.265', 'h265': 'H.265',
      'VP80': 'VP8', 'VP90': 'VP9', 'AV01': 'AV1',
      'DIV3': 'DivX v3', 'DIVX': 'DivX', 'XVID': 'Xvid', 'xvid': 'Xvid',
      'MP4V': 'MPEG-4 ASP', 'MP42': 'MPEG-4 v2', 'MP43': 'MPEG-4 v3',
      'WMV1': 'WMV 7', 'WMV2': 'WMV 8', 'WMV3': 'WMV 9',
      'I420': 'YUV 4:2:0', 'YUY2': 'YUY2', 'UYVY': 'UYVY',
    };
    const AUDIO_TAGS: Record<number, string> = {
      0x0001: 'PCM', 0x0050: 'MP3', 0x0055: 'MPEG-1 Audio',
      0x00FF: 'AAC', 0x0161: 'AC-3', 0x2000: 'AC-3',
      0x0092: 'Vorbis', 0x0069: 'DTS',
    };

    // 递归扫描 LIST 块以找到嵌套的 strl（AVI 中 strl 位于 hdrl 内部）
    function scanList(start: number, end: number) {
      let off = start;
      while (off + 12 <= end) {
        const fcc = fccAt(off);
        const chunkSize = dwAt(off + 4);

        if (fcc === 'LIST') {
          if (chunkSize < 4 || off + 8 + chunkSize > end) break;
          const subType = fccAt(off + 8);

          if (subType === 'strl') {
            // 找到流列表，解析 strh/strf
            const strlEnd = off + 8 + chunkSize;
            let co = off + 12; // skip LIST + size + 'strl'
            let videoDone = false, audioDone = false;

            while (co + 8 <= strlEnd && !(videoDone && audioDone)) {
              const cFcc = fccAt(co);
              const cSize = dwAt(co + 4);
              if (cSize < 2 || co + 8 + cSize > strlEnd) break;

              if (cFcc === 'strh' && cSize >= 12) {
                const sType = r4(view, co + 8);  // 'vids' | 'auds'
                const handler = r4(view, co + 12); // codec fourCC

                if (sType === 'vids' && !videoDone) {
                  const name = CODEC_MAP[handler] || handler.replace(/\x00/g, '') || 'Unknown';
                  tracks.push({ type: 'video', codecName: name, codecString: handler });
                  videoDone = true;
                } else if (sType === 'auds' && !audioDone) {
                  let audioName = handler.replace(/\x00/g, '') || 'Unknown Audio';
                  // Scan same strl for strf to get format tag
                  let sOff = co + 8 + cSize + (cSize % 2);
                  while (sOff + 8 <= strlEnd) {
                    const sFcc = fccAt(sOff);
                    const sSize = dwAt(sOff + 4);
                    if (sSize < 2 || sOff + 8 + sSize > strlEnd) break;
                    if (sFcc === 'strf') {
                      const tag = view.getUint16(sOff + 8, true);
                      audioName = AUDIO_TAGS[tag] || `Audio (0x${tag.toString(16)})`;
                      break;
                    }
                    sOff += 8 + sSize + (sSize % 2);
                  }
                  tracks.push({ type: 'audio', codecName: audioName, codecString: handler });
                  audioDone = true;
                }
              }
              co += 8 + cSize + (cSize % 2);
            }
          } else {
            // 非 strl 的 LIST（如 hdrl），递归进入其内部继续搜索
            scanList(off + 12, off + 8 + chunkSize);
          }
          off += 8 + chunkSize + (chunkSize % 2);
        } else {
          // 非 LIST 块（如 avih 等），跳过
          if (chunkSize < 2 || off + 8 + chunkSize > end) break;
          off += 8 + chunkSize + (chunkSize % 2);
        }
      }
    }

    // RIFF header: offset 0='RIFF', 4=size, 8='AVI ', 12=start of content
    scanList(12, scanLen);

    if (tracks.length === 0) errors.push('未检测到媒体轨道');
    return { tracks, errors };
  }

  // ===== MPEG-TS 解析 =====
  function parseTs(view: DataView): { tracks: TrackInfo[]; errors: string[]; detail?: string } {
    const tracks: TrackInfo[] = [];
    const errors: string[] = [];

    const TS_PKT_SIZE = 188;
    const maxPackets = Math.min(Math.floor(view.byteLength / TS_PKT_SIZE), 50000);
    if (maxPackets < 3) { errors.push('TS 文件太短'); return { tracks, errors }; }

    const STREAM_INFO: Record<number, { type: 'video' | 'audio'; name: string; codec: string }> = {
      0x01: { type: 'video', name: 'MPEG-1 Video', codec: 'mpeg1' },
      0x02: { type: 'video', name: 'MPEG-2 Video', codec: 'mpeg2' },
      0x03: { type: 'audio', name: 'MPEG-1 Audio', codec: 'mpga' },
      0x04: { type: 'audio', name: 'MPEG-2 Audio', codec: 'mpga' },
      0x0F: { type: 'audio', name: 'AAC', codec: 'mp4a.40.2' },
      0x1B: { type: 'video', name: 'H.264/AVC', codec: 'avc1' },
      0x24: { type: 'video', name: 'H.265/HEVC', codec: 'hev1' },
      0xEA: { type: 'video', name: 'VC-1', codec: 'vc-1' },
      0x81: { type: 'audio', name: 'AC-3', codec: 'ac-3' },
      0x87: { type: 'audio', name: 'E-AC-3', codec: 'ec-3' },
    };

    // 定位同步头（连续 3 个 0x47 确认）
    let syncOff = -1;
    for (let i = 0; i < TS_PKT_SIZE; i++) {
      if (view.getUint8(i) !== 0x47) continue;
      let ok = true;
      for (let j = 1; j < 3; j++) {
        if (i + j * TS_PKT_SIZE >= view.byteLength || view.getUint8(i + j * TS_PKT_SIZE) !== 0x47) { ok = false; break; }
      }
      if (ok) { syncOff = i; break; }
    }
    if (syncOff < 0) { errors.push('未找到 TS 同步头'); return { tracks, errors }; }

    function tsPid(pktOff: number): number {
      return ((view.getUint8(pktOff + 1) & 0x1f) << 8) | view.getUint8(pktOff + 2);
    }
    function hasPayload(pktOff: number): boolean {
      const adapt = (view.getUint8(pktOff + 3) >> 4) & 0x03;
      return adapt === 1 || adapt === 3;
    }
    function payloadOffset(pktOff: number): number {
      const adapt = (view.getUint8(pktOff + 3) >> 4) & 0x03;
      if (adapt === 3) return 4 + 1 + view.getUint8(pktOff + 4); // header + adapt_len_byte + actual
      if (adapt === 1) return 4; // header only
      return 0; // no payload
    }
    function pusi(pktOff: number): boolean {
      return !!(view.getUint8(pktOff + 1) & 0x40);
    }

    // 解析 PAT → 获取 PMT PID
    let pmtPid = -1;
    let detail = '';

    for (let i = 0; i < maxPackets && pmtPid < 0; i++) {
      const pOff = syncOff + i * TS_PKT_SIZE;
      if (pOff + TS_PKT_SIZE > view.byteLength || view.getUint8(pOff) !== 0x47) break;
      if (tsPid(pOff) !== 0 || !hasPayload(pOff) || !pusi(pOff)) continue;

      let payOff = pOff + payloadOffset(pOff);
      if (payOff >= view.byteLength) continue;
      const ptr = view.getUint8(payOff);
      payOff += 1 + ptr; // skip pointer field
      if (payOff + 8 > view.byteLength || view.getUint8(payOff) !== 0x00) continue; // table_id = PAT

      const secLen = ((view.getUint8(payOff + 1) & 0x0f) << 8) | view.getUint8(payOff + 2);
      if (secLen > view.byteLength - payOff - 3) continue;

      const progEnd = payOff + 3 + secLen - 4; // -4 for CRC
      let progOff = payOff + 8; // past table header
      while (progOff + 4 <= progEnd) {
        const progNum = view.getUint16(progOff);
        if (progNum !== 0) {
          pmtPid = ((view.getUint8(progOff + 2) & 0x1f) << 8) | view.getUint8(progOff + 3);
          detail = `PMT PID: 0x${pmtPid.toString(16).padStart(4, '0')}`;
          break;
        }
        progOff += 4;
      }
    }

    if (pmtPid < 0) { errors.push('未找到节目映射表(PMT)'); return { tracks, errors }; }

    // 解析 PMT → 提取流类型
    for (let i = 0; i < maxPackets; i++) {
      const pOff = syncOff + i * TS_PKT_SIZE;
      if (pOff + TS_PKT_SIZE > view.byteLength || view.getUint8(pOff) !== 0x47) continue;
      if (tsPid(pOff) !== pmtPid || !hasPayload(pOff) || !pusi(pOff)) continue;

      let payOff = pOff + payloadOffset(pOff);
      if (payOff >= view.byteLength) continue;
      const ptr = view.getUint8(payOff);
      payOff += 1 + ptr;
      if (payOff + 12 > view.byteLength || view.getUint8(payOff) !== 0x02) continue; // table_id = PMT

      const secLen = ((view.getUint8(payOff + 1) & 0x0f) << 8) | view.getUint8(payOff + 2);
      if (secLen > view.byteLength - payOff - 3) continue;

      const progInfoLen = ((view.getUint8(payOff + 10) & 0x0f) << 8) | view.getUint8(payOff + 11);
      let esOff = payOff + 12 + progInfoLen;
      const esEnd = payOff + 3 + secLen - 4;

      while (esOff + 5 <= esEnd) {
        const streamType = view.getUint8(esOff);
        const esInfoLen = ((view.getUint8(esOff + 3) & 0x0f) << 8) | view.getUint8(esOff + 4);
        const info = STREAM_INFO[streamType];
        if (info) {
          tracks.push({ type: info.type, codecName: info.name, codecString: info.codec });
        } else if (streamType !== 0x06 && streamType !== 0x05) {
          tracks.push({ type: 'video', codecName: `Stream 0x${streamType.toString(16)}`, codecString: '' });
        }
        esOff += 5 + esInfoLen;
      }
      break;
    }

    if (tracks.length === 0) errors.push('未检测到编码轨道');
    return { tracks, errors, detail };
  }
  async function handleFile(file: File) {
    isParsing = true;
    result = null;
    videoFile = file;
    playbackOk = false;
    playbackError = '';
    videoWidth = 0;
    videoHeight = 0;
    videoDuration = 0;

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(file);

    try {
      // 读取文件内容（小文件全部读取，大文件取前 32MB）
      const readSize = file.size <= 32 * 1024 * 1024 ? file.size : 32 * 1024 * 1024;
      const chunk = await file.slice(0, readSize).arrayBuffer();
      const view = new DataView(chunk);
      result_buf = view;

      // 容器检测（magic bytes）
      let container = '未知';
      let containerDetail = '';

      if (chunk.byteLength >= 12) {
        const off4 = view.getUint32(4);
        // MP4: box size + 'ftyp'
        if (r4(view, 4) === 'ftyp') {
          container = 'MP4';
        } else if (r4(view, 0) === '\x1a\x45\xdf\xa3') {
          container = 'WebM / MKV';
        } else if (r4(view, 0) === 'OggS') {
          container = 'Ogg';
        } else if (r4(view, 0) === 'RIFF' && r4(view, 8) === 'AVI ') {
          container = 'AVI';
        }
      }

      // TS 检测：前 192 字节内找连续 3 个 0x47 同步字节
      if (container === '未知' && chunk.byteLength >= 188 * 3) {
        for (let si = 0; si < 192; si++) {
          if (view.getUint8(si) !== 0x47) continue;
          if (view.getUint8(si + 188) === 0x47 && view.getUint8(si + 376) === 0x47) {
            container = 'MPEG-TS';
            break;
          }
        }
      }

      let tracks: TrackInfo[] = [];
      let errs: string[] = [];

      if (container === 'MP4') {
        const r = parseMp4(view);
        tracks = r.tracks;
        errs = r.errors;
        containerDetail = r.ftyp || '';
      } else if (container === 'WebM / MKV') {
        const r = parseWebM(chunk);
        tracks = r.tracks;
        errs = r.errors;
      } else if (container === 'Ogg') {
        const r = parseOgg(view);
        tracks = r.tracks;
        errs = r.errors;
      } else if (container === 'AVI') {
        const r = parseAvi(view);
        tracks = r.tracks;
        errs = r.errors;
      } else if (container === 'MPEG-TS') {
        const r = parseTs(view);
        tracks = r.tracks;
        errs = r.errors;
        containerDetail = r.detail || '';
      } else {
        errs.push('无法识别的容器格式');
      }

      // 检测浏览器兼容性
      for (const t of tracks) {
        const mime = `${t.type === 'video' ? 'video' : 'audio'}/${container === 'WebM / MKV' ? 'webm' : container === 'Ogg' ? 'ogg' : container === 'MPEG-TS' ? 'mp2t' : container === 'AVI' ? 'x-msvideo' : 'mp4'}; codecs="${t.codecString}"`;
        try {
          const el = t.type === 'video' ? document.createElement('video') : document.createElement('audio');
          t.browserSupported = el.canPlayType(mime) !== '';
        } catch { t.browserSupported = false; }
        try {
          t.mseSupported = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mime);
        } catch { t.mseSupported = false; }
      }

      result = {
        container,
        containerDetail,
        fileSize: file.size,
        fileName: file.name,
        tracks,
        errors: errs,
      };
    } catch (e) {
      result = {
        container: '解析失败',
        containerDetail: '',
        fileSize: file.size,
        fileName: file.name,
        tracks: [],
        errors: [e instanceof Error ? e.message : String(e)],
      };
    }
    isParsing = false;
  }

  function onDrop(e: DragEvent) {
    isDragging = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }

  function onFileInput(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) handleFile(f);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function formatDuration(s: number) {
    if (!isFinite(s) || s <= 0) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  onMount(() => {
    // 视频元素事件监听
  });

  function onVideoLoaded() {
    if (!videoEl) return;
    videoWidth = videoEl.videoWidth;
    videoHeight = videoEl.videoHeight;
    videoDuration = videoEl.duration;
  }

  function onVideoPlay() { playbackOk = true; playbackError = ''; }
  function onVideoError() {
    if (!videoEl) return;
    const err = videoEl.error;
    playbackError = err?.message || `错误码 ${err?.code || '?'}`;
  }
</script>

<svelte:head>
  <title>视频编码格式检测 - 工具集</title>
</svelte:head>

<div class="bg-gray-50 min-h-[calc(100vh-4rem)]">
  <main class="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900">视频编码格式检测</h2>
      <p class="mt-0.5 text-gray-500 text-sm">上传视频文件，解析容器格式、视频/音频编码及浏览器兼容性</p>
    </div>

    {#if videoUrl && result}
      <!-- 有文件时：左右分栏布局 -->
      <div class="flex gap-4 items-start">
        <!-- 左栏：上传区 + 视频预览 -->
        <div class="w-[55%] shrink-0 space-y-3">
          <!-- 紧凑上传区域 -->
          <div
            class="relative border-2 border-dashed rounded-lg px-4 py-2.5 text-center cursor-pointer transition-colors
              {isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-white hover:border-gray-400'}"
            ondragover={(e: DragEvent) => { e.preventDefault(); isDragging = true; }}
            ondragleave={() => (isDragging = false)}
            ondrop={(e: DragEvent) => { e.preventDefault(); onDrop(e); }}
            onclick={() => document.getElementById('file-input')?.click()}
            onkeydown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
            role="button"
            tabindex="0"
          >
            <input id="file-input" type="file" accept="video/*,.mkv,.webm,.ogg,.avi,.mp4,.mov,.flv,.ts" class="hidden" onchange={onFileInput} />
            {#if isParsing}
              <div class="text-gray-500 text-sm">解析中…</div>
            {:else if videoFile}
              <span class="text-sm text-gray-700 font-medium">{videoFile.name}</span>
              <span class="text-gray-400 text-xs ml-2">({formatSize(videoFile.size)})</span>
              <span class="text-gray-400 text-xs ml-2">拖拽替换</span>
            {:else}
              <span class="text-gray-400 text-sm">拖拽视频文件到此处，或点击选择</span>
            {/if}
          </div>

          <!-- 视频预览 -->
          <div class="bg-black rounded-lg overflow-hidden">
            <video
              bind:this={videoEl}
              src={videoUrl}
              controls
              class="w-full max-h-[calc(100vh-14rem)]"
              onloadedmetadata={onVideoLoaded}
              onplay={onVideoPlay}
              onerror={onVideoError}
            ></video>
          </div>
        </div>

        <!-- 右栏：解析结果 -->
        <div class="flex-1 min-w-0 space-y-3">
          <!-- 文件信息 -->
          <section class="bg-white rounded-lg border border-gray-200 p-3">
            <h3 class="text-xs font-semibold text-gray-800 mb-2">文件信息</h3>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div>
                <span class="text-gray-400 text-xs">容器</span>
                <span class="font-medium ml-1">{result.container}</span>
                {#if result.containerDetail}
                  <span class="text-gray-400 text-xs ml-1">{result.containerDetail}</span>
                {/if}
              </div>
              <div>
                <span class="text-gray-400 text-xs">大小</span>
                <span class="font-medium ml-1">{formatSize(result.fileSize)}</span>
              </div>
              {#if videoWidth > 0}
                <div>
                  <span class="text-gray-400 text-xs">分辨率</span>
                  <span class="font-medium ml-1">{videoWidth} × {videoHeight}</span>
                </div>
              {/if}
              {#if videoDuration > 0}
                <div>
                  <span class="text-gray-400 text-xs">时长</span>
                  <span class="font-medium ml-1">{formatDuration(videoDuration)}</span>
                </div>
              {/if}
            </div>
          </section>

          <!-- 编码轨道 -->
          <section class="bg-white rounded-lg border border-gray-200 p-3">
            <h3 class="text-xs font-semibold text-gray-800 mb-2">编码轨道</h3>
            {#if result.tracks.length === 0}
              <div class="text-gray-400 text-sm">未检测到编码轨道</div>
            {:else}
              <div class="space-y-1.5">
                {#each result.tracks as track}
                  <div class="flex items-center gap-2 px-2.5 py-2 rounded-md bg-gray-50 border border-gray-100">
                    <span class="shrink-0 px-1.5 py-0.5 text-[11px] font-medium rounded
                      {track.type === 'video' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}">
                      {track.type === 'video' ? '视频' : '音频'}
                    </span>
                    <div class="min-w-0 flex-1">
                      <span class="text-sm font-medium text-gray-900">{track.codecName}</span>
                      <span class="text-xs text-gray-400 font-mono ml-1.5">{track.codecString}</span>
                    </div>
                    <div class="shrink-0 text-xs">
                      {#if track.browserSupported}
                        <span class="text-green-500" title="canPlayType 支持">✅</span>
                      {:else}
                        <span class="text-gray-400" title="canPlayType 不支持">❌</span>
                      {/if}
                      {#if track.mseSupported}
                        <span class="text-indigo-500 text-[11px] ml-0.5" title="MediaSource.isTypeSupported 支持">MSE</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </section>

          <!-- 播放测试 -->
          {#if videoUrl}
            <section class="bg-white rounded-lg border border-gray-200 p-3">
              <h3 class="text-xs font-semibold text-gray-800 mb-1.5">播放测试</h3>
              {#if playbackOk}
                <span class="text-sm text-green-600">✅ 浏览器可正常播放</span>
              {:else if playbackError}
                <span class="text-sm text-red-500">❌ 播放失败：{playbackError}</span>
              {:else}
                <span class="text-sm text-gray-400">点击播放按钮以测试</span>
              {/if}
            </section>
          {/if}

          <!-- 错误信息 -->
          {#if result.errors.length > 0}
            <section class="bg-red-50 rounded-lg border border-red-200 p-3">
              <h3 class="text-xs font-semibold text-red-700 mb-1">解析问题</h3>
              {#each result.errors as err}
                <div class="text-sm text-red-600">· {err}</div>
              {/each}
            </section>
          {/if}
        </div>
      </div>
    {:else}
      <!-- 无文件时：居中上传区域 -->
      <div
        class="relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6
          {isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-white hover:border-gray-400'}"
        ondragover={(e: DragEvent) => { e.preventDefault(); isDragging = true; }}
        ondragleave={() => (isDragging = false)}
        ondrop={(e: DragEvent) => { e.preventDefault(); onDrop(e); }}
        onclick={() => document.getElementById('file-input')?.click()}
        onkeydown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
        role="button"
        tabindex="0"
      >
        <input id="file-input" type="file" accept="video/*,.mkv,.webm,.ogg,.avi,.mp4,.mov,.flv,.ts" class="hidden" onchange={onFileInput} />
        {#if isParsing}
          <div class="text-gray-500">解析中…</div>
        {:else if videoFile}
          <div class="text-sm text-gray-700">
            <span class="font-medium">{videoFile.name}</span>
            <span class="text-gray-400 ml-2">({formatSize(videoFile.size)})</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">点击或拖拽新文件以替换</div>
        {:else}
          <div class="text-gray-400 text-sm">拖拽视频文件到此处，或点击选择文件</div>
          <div class="text-xs text-gray-300 mt-2">支持 MP4, WebM, MKV, Ogg, AVI, MOV 等格式</div>
        {/if}
      </div>

      <!-- 无文件时视频预览（解析中也会走到这里） -->
      {#if videoUrl && !result}
        <div class="mb-6 bg-black rounded-xl overflow-hidden">
          <video
            bind:this={videoEl}
            src={videoUrl}
            controls
            class="w-full max-h-[400px]"
            onloadedmetadata={onVideoLoaded}
            onplay={onVideoPlay}
            onerror={onVideoError}
          ></video>
        </div>
      {/if}

      <!-- 底部说明 -->
      <div class="mt-8 text-xs text-gray-400 space-y-1">
        <p>· 通过解析文件二进制结构提取编码信息：MP4 解析 box 结构、WebM/MKV 解析 EBML 编码标识、Ogg 解析页面头。</p>
        <p>· 浏览器兼容性通过 <code class="text-gray-500">canPlayType</code> 和 <code class="text-gray-500">MediaSource.isTypeSupported</code> 检测。</p>
        <p>· 仅读取文件头部（最多 32MB），不会上传文件到任何服务器。</p>
      </div>
    {/if}
  </main>
</div>
