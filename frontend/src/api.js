export async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      message = response.statusText;
    }
    throw new Error(message || "Request failed");
  }
  return response.json();
}
