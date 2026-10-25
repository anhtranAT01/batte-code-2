function createOnlineCountBroadcaster(io, { delayMs = 500, getCount = () => io.engine.clientsCount } = {}) {
  let timer = null;

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      io.emit('online:count', { count: getCount() });
    }, delayMs);
    timer.unref?.();
  }

  function close() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  return { schedule, close };
}

module.exports = { createOnlineCountBroadcaster };
