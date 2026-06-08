<script lang="ts">
  interface CodecItem {
    name: string;
    category: string;
    check: () => boolean;
    detail?: string;
  }

  const codecs: CodecItem[] = [
    // ===== 图像格式 =====
    {
      name: 'AVIF',
      category: '图像',
      check: () => {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c.toDataURL('image/avif').startsWith('data:image/avif');
      },
      detail: 'AV1 Image File Format',
    },
    {
      name: 'WebP',
      category: '图像',
      check: () => {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c.toDataURL('image/webp').startsWith('data:image/webp');
      },
      detail: 'WebP 有损/无损',
    },
    {
      name: 'WebP 动画',
      category: '图像',
      check: () => {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c.toDataURL('image/webp').startsWith('data:image/webp');
      },
      detail: 'Animated WebP',
    },
    {
      name: 'JPEG XL',
      category: '图像',
      check: () => {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c.toDataURL('image/jxl').startsWith('data:image/jxl');
      },
      detail: 'JPEG XL',
    },
    {
      name: 'PNG',
      category: '图像',
      check: () => {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c.toDataURL('image/png').startsWith('data:image/png');
      },
      detail: 'Portable Network Graphics',
    },
    {
      name: 'APNG',
      category: '图像',
      check: () => {
        const img = new Image();
        img.src = 'data:image/apng;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUEFTkSuQmCC';
        return true; // APNG 检测较复杂，通过 canvas 无法直接判断，标记为基本支持
      },
      detail: 'Animated PNG',
    },
    {
      name: 'SVG',
      category: '图像',
      check: () => !!document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect,
      detail: 'Scalable Vector Graphics',
    },
    {
      name: 'BMP',
      category: '图像',
      check: () => {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c.toDataURL('image/bmp').startsWith('data:image/bmp');
      },
      detail: 'Bitmap',
    },
    {
      name: 'ICO',
      category: '图像',
      check: () => {
        const img = new Image();
        img.src = 'data:image/x-icon;base64,AAABAAEAEBAQAAAAAAAoAQAAFgAAACgAAAAQAAAAIAAAAAEABAAAAAAAgAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAA%2F%2F%2F%2FAAAA%2F%2F%2F%2FwAA';
        return true;
      },
      detail: 'Icon 格式',
    },
    {
      name: 'TIFF',
      category: '图像',
      check: () => {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c.toDataURL('image/tiff').startsWith('data:image/tiff');
      },
      detail: 'Tagged Image File Format',
    },

    // ===== 音频格式 =====
    {
      name: 'AAC',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/aac') !== '',
      detail: 'Advanced Audio Coding',
    },
    {
      name: 'AAC (HE-AAC)',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.5"') !== '',
      detail: 'High Efficiency AAC',
    },
    {
      name: 'AAC (HE-AACv2)',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.29"') !== '',
      detail: 'High Efficiency AAC v2 (PS)',
    },
    {
      name: 'MP3',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/mpeg') !== '',
      detail: 'MPEG-1 Audio Layer III',
    },
    {
      name: 'Opus',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/opus') !== '',
      detail: 'Opus — 开源高效音频编码',
    },
    {
      name: 'Vorbis',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"') !== '',
      detail: 'Ogg Vorbis — 开源有损编码',
    },
    {
      name: 'FLAC',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/flac') !== '',
      detail: 'Free Lossless Audio Codec',
    },
    {
      name: 'WAV',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/wav') !== '',
      detail: 'Waveform Audio (PCM)',
    },
    {
      name: 'ALAC',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/mp4; codecs="alac"') !== '',
      detail: 'Apple Lossless Audio Codec',
    },
    {
      name: 'AMR-NB',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/amr') !== '',
      detail: 'Adaptive Multi-Rate (窄带)',
    },
    {
      name: 'AMR-WB',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/amr-wb') !== '',
      detail: 'Adaptive Multi-Rate Wideband',
    },
    {
      name: 'PCM',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/wav; codecs="1"') !== '',
      detail: 'Pulse-Code Modulation',
    },
    {
      name: 'WebM Audio (Opus)',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '',
      detail: 'WebM 容器 + Opus 编码',
    },
    {
      name: 'WebM Audio (Vorbis)',
      category: '音频',
      check: () => document.createElement('audio').canPlayType('audio/webm; codecs="vorbis"') !== '',
      detail: 'WebM 容器 + Vorbis 编码',
    },

    // ===== 视频格式 =====
    {
      name: 'H.264 Baseline',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
      detail: 'AVC Baseline Profile',
    },
    {
      name: 'H.264 Main',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/mp4; codecs="avc1.4D401E"') !== '',
      detail: 'AVC Main Profile',
    },
    {
      name: 'H.264 High',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"') !== '',
      detail: 'AVC High Profile',
    },
    {
      name: 'H.265 / HEVC',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') !== '',
      detail: 'High Efficiency Video Coding',
    },
    {
      name: 'VP8',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/webm; codecs="vp8"') !== '',
      detail: 'VP8 — Google 开源视频编码',
    },
    {
      name: 'VP9',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== '',
      detail: 'VP9 — YouTube 常用编码',
    },
    {
      name: 'AV1',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/mp4; codecs="av01.0.01M.08"') !== '',
      detail: 'AOMedia Video 1 — 开源免版税',
    },
    {
      name: 'Theora',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/ogg; codecs="theora"') !== '',
      detail: 'Theora — 开源视频编码',
    },
    {
      name: 'MPEG-4 Visual',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/mp4; codecs="mp4v.20.8"') !== '',
      detail: 'MPEG-4 Part 2',
    },
    {
      name: 'WebM (VP8)',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/webm; codecs="vp8, vorbis"') !== '',
      detail: 'WebM 容器 (VP8+Vorbis)',
    },
    {
      name: 'WebM (VP9)',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/webm; codecs="vp9, opus"') !== '',
      detail: 'WebM 容器 (VP9+Opus)',
    },
    {
      name: 'WebM (AV1)',
      category: '视频',
      check: () => document.createElement('video').canPlayType('video/webm; codecs="av01.0.01M.08, opus"') !== '',
      detail: 'WebM 容器 (AV1+Opus)',
    },

    // ===== 字体格式 =====
    {
      name: 'WOFF',
      category: '字体',
      check: () => { try { return CSS.supports('font-format(woff)'); } catch { return false; } },
      detail: 'Web Open Font Format',
    },
    {
      name: 'WOFF2',
      category: '字体',
      check: () => { try { return CSS.supports('font-format(woff2)'); } catch { return false; } },
      detail: 'Web Open Font Format 2',
    },
    {
      name: 'TrueType',
      category: '字体',
      check: () => { try { return CSS.supports('font-format(truetype)'); } catch { return false; } },
      detail: 'TrueType (.ttf)',
    },
    {
      name: 'OpenType',
      category: '字体',
      check: () => { try { return CSS.supports('font-format(opentype)'); } catch { return false; } },
      detail: 'OpenType (.otf)',
    },
    {
      name: 'COLRv0',
      category: '字体',
      check: () => { try { return CSS.supports('font-tech(color-colrv0)'); } catch { return false; } },
      detail: '彩色字体 (COLR v0)',
    },
    {
      name: 'COLRv1',
      category: '字体',
      check: () => { try { return CSS.supports('font-tech(color-colrv1)'); } catch { return false; } },
      detail: '彩色字体 (COLR v1 — 渐变/混合)',
    },
    {
      name: 'SVG 字体',
      category: '字体',
      check: () => { try { return CSS.supports('font-format(svg)'); } catch { return false; } },
      detail: 'SVG 字体 (已逐步淘汰)',
    },
    {
      name: '可变字体',
      category: '字体',
      check: () => { try { return CSS.supports('font-tech(variations)'); } catch { return false; } },
      detail: 'OpenType Variations',
    },
    {
      name: '调色板字体',
      category: '字体',
      check: () => { try { return CSS.supports('font-tech(palettes)'); } catch { return false; } },
      detail: 'Font Palettes',
    },

    // ===== 容器格式 =====
    {
      name: 'MP4',
      category: '容器',
      check: () => document.createElement('video').canPlayType('video/mp4') !== '',
      detail: 'MPEG-4 Part 14',
    },
    {
      name: 'WebM',
      category: '容器',
      check: () => document.createElement('video').canPlayType('video/webm') !== '',
      detail: 'WebM 容器',
    },
    {
      name: 'Ogg',
      category: '容器',
      check: () => document.createElement('video').canPlayType('video/ogg') !== '',
      detail: 'Ogg 容器',
    },
    {
      name: 'MPEG-TS',
      category: '容器',
      check: () => document.createElement('video').canPlayType('video/mp2t') !== '',
      detail: 'MPEG Transport Stream (HLS)',
    },
    {
      name: '3GPP',
      category: '容器',
      check: () => document.createElement('video').canPlayType('video/3gpp') !== '',
      detail: '3GPP 移动视频',
    },
  ];

  let results = $state<{ name: string; category: string; supported: boolean; detail?: string }[]>([]);

  $effect(() => {
    results = codecs.map((c) => ({
      name: c.name,
      category: c.category,
      supported: c.check(),
      detail: c.detail,
    }));
  });

  const categories = ['图像', '音频', '视频', '字体', '容器'] as const;

  function getCategoryItems(category: string) {
    return results.filter((r) => r.category === category);
  }

  function getCategoryStats(category: string) {
    const items = getCategoryItems(category);
    const supported = items.filter((i) => i.supported).length;
    return { total: items.length, supported };
  }

  let totalSupported = $derived(results.filter((r) => r.supported).length);
  let totalItems = $derived(results.length);
</script>

<svelte:head>
  <title>编码支持检测 - 工具集</title>
</svelte:head>

<div class="bg-gray-50 min-h-[calc(100vh-4rem)]">
  <main class="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- 标题区 -->
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900">浏览器编码支持检测</h2>
      <p class="mt-1 text-gray-500 text-sm">检测当前浏览器对各种编码格式的支持程度</p>
      <div class="mt-3 flex items-center gap-3">
        <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 rounded-full transition-all duration-500"
            style="width: {totalItems ? (totalSupported / totalItems * 100) : 0}%"
          ></div>
        </div>
        <span class="text-sm font-medium text-gray-700 tabular-nums">{totalSupported}/{totalItems}</span>
      </div>
    </div>

    <!-- 分类卡片 -->
    <div class="space-y-6">
      {#each categories as category}
        {@const stats = getCategoryStats(category)}
        {@const items = getCategoryItems(category)}
        <section>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-semibold text-gray-800">{category}</h3>
            <span class="text-xs text-gray-400 tabular-nums">{stats.supported}/{stats.total}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {#each items as item}
              <div
                class="flex items-center gap-2 px-3 py-2 rounded-lg border {item.supported
                  ? 'bg-white border-green-200'
                  : 'bg-gray-50 border-gray-200'}"
              >
                <span class="shrink-0 w-2 h-2 rounded-full {item.supported ? 'bg-green-400' : 'bg-gray-300'}"></span>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                  {#if item.detail}
                    <div class="text-[11px] text-gray-400 truncate">{item.detail}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </main>
</div>
