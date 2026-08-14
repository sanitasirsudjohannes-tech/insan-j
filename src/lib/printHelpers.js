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
    // Bersihkan iframe cetak sebelumnya jika masih ada
    if (frameRef?.current && frameRef.current.parentNode) {
      frameRef.current.parentNode.removeChild(frameRef.current);
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

    const cleanup = () => {
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        if (frameRef && frameRef.current === iframe) {
          frameRef.current = null;
        }
      }, 1000);
    };

    const triggerPrint = () => {
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

    // Beri sedikit waktu agar browser (khususnya HP) selesai merender
    // tabel sebelum dialog cetak dibuka.
    if (doc.readyState === 'complete') {
      setTimeout(triggerPrint, 300);
    } else {
      iframe.onload = () => setTimeout(triggerPrint, 300);
      // Jaga-jaga kalau onload tidak terpanggil di sebagian browser
      setTimeout(triggerPrint, 1200);
    }
  });
}
