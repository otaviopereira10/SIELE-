/**
 * Archivos de una carpeta de grabaciones que una grabación posterior del mismo segmento ha dejado sin uso.
 * Borrar uno de más perdería la voz del estudiante, así que solo se eligen los que cumplen todo esto:
 * son de ese segmento, ninguna grabación los usa y son anteriores a la vigente (una subida más reciente
 * puede estar a punto de registrarse). Las claves llegan validadas con [a-z0-9_-].
 */
export function replacedRecordingFiles(files: string[], partKey: string, segmentKey: string, currentFile: string, registered: ReadonlySet<string>): string[] {
  const pattern = new RegExp(`^${partKey}-${segmentKey}(?:-(\\d{10,16}))?\\.[a-z0-9]+$`);
  const stamp = (name: string) => Number(pattern.exec(name)?.[1] ?? 0);
  const current = stamp(currentFile);
  return files.filter((name) => pattern.test(name) && !registered.has(name) && stamp(name) < current);
}
