/**
 * printHelpers.js
 * Mencetak konten HTML via hidden iframe agar tidak kena blokir popup browser,
 * terutama pada mobile setelah alur async (SweetAlert2 await).
 *
 * @param {string} htmlContent  - String HTML lengkap yang akan dicetak.
 * @param {React.MutableRefObject} frameRef - useRef() dari komponen pemanggil (untuk cleanup).
 * @returns {Promise<boolean>} true jika print berhasil dipanggil.
 */
export function printViaHiddenIframe(htmlContent, frameRef) {
  return new Promise((resolve) => {
    // Bersihkan iframe cetak sebelumnya jika masih ada.
    if (frameRef?.current && frameRef.current.parentNode) {
      frameRef.current.parentNode.removeChild(frameRef.current);
      frameRef.current = null;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    if (frameRef) frameRef.current = iframe;

    let printed = false;
    let fallbackTimer = null;
    let cleanupTimer = null;

    const cleanup = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
      }

      // Beri waktu agar dialog print selesai sebelum iframe dibuang.
      cleanupTimer = setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        if (frameRef && frameRef.current === iframe) {
          frameRef.current = null;
        }
      }, 1000);
    };

    // Pastikan print hanya dipanggil sekali. Sebelumnya onload dan fallback
    // timer sama-sama dapat memanggil triggerPrint(), sehingga browser bisa
    // membuka dialog cetak dua kali.
    const triggerPrint = () => {
      if (printed) return;
      printed = true;

      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        resolve(true);
      } catch (err) {
        console.error('Print error:', err);
        resolve(false);
      } finally {
        cleanup();
      }
    };

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Tunggu iframe selesai dimuat. Jika event load tidak terpanggil pada
    // browser tertentu, fallback tetap tersedia tetapi hanya bisa men-trigger
    // print satu kali karena dijaga oleh flag `printed`.
    iframe.onload = () => {
      setTimeout(triggerPrint, 300);
    };

    fallbackTimer = setTimeout(triggerPrint, 1200);
  });
}
