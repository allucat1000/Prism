return {
  login: async () => {
    await new Promise(r => setTimeout(r, 1000));

    return new Promise((resolve, reject) => {
      const win = window.open(
        `https://rotur.dev/auth?styles=https://origin.mistium.com/Resources/auth.css&return_to=${window.location.origin}/Prism/authSuccess`,
        "_blank"
      );

      if (!win) {
        console.error("[ROTUR] Login window doesn't exist!");
        return reject("Fail");
      }

      const interval = setInterval(() => {
        if (win.closed) {
          console.error("[ROTUR] Login window closed!");
          clearInterval(interval);
          window.removeEventListener("message", listener);
          reject("Fail");
        }
      }, 200);

      const listener = ev => {
        if (ev.origin !== "https://rotur.dev") return;

        if (ev.data.type === "rotur-auth-token") {
          window.removeEventListener("message", listener);
          clearInterval(interval);
          const token = ev.data.token;
          win.close();
          resolve(token);
        }
      };

      window.addEventListener("message", listener);
    });
  }
};
