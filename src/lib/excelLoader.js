let excelLibraryPromise;

/**
 * Muat SheetJS hanya ketika fitur impor, ekspor, atau template Excel dipakai.
 * Promise dibagikan agar klik beruntun tidak mengunduh modul lebih dari sekali.
 */
export function loadExcelLibrary() {
  if (!excelLibraryPromise) {
    excelLibraryPromise = import('xlsx').catch((error) => {
      excelLibraryPromise = undefined;
      throw error;
    });
  }

  return excelLibraryPromise;
}
