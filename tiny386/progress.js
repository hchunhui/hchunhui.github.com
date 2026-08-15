(function() {
const globalContainer = document.getElementById('progress');

function createGlobalProgressBar(url) {
    const shortName = typeof url === 'string' ? url.split('/').pop().split('?')[0] : '???';
    const item = document.createElement('div');
    item.innerHTML = `
                <span class="task-name" title="${url}"><b>${shortName}</b></span>
                <span class="task-percent">0%</span>
                <progress value="0" max="100"></progress>
            `;
    globalContainer.appendChild(item);

    const progressBar = item.querySelector('progress');
    const percentText = item.querySelector('.task-percent');

    return {
        update: (percent) => {
            progressBar.value = percent;
            percentText.textContent = `${percent}%`;
        },
        destroy: () => {
            item.remove();
        }
    };
}

const originalFetch = window.fetch;

window.fetch = function(input, init = {}) {
    const requestUrl = (typeof input === 'string' || input instanceof URL) ? input : (input.url || '');
    const ui = createGlobalProgressBar(requestUrl);

    return originalFetch.apply(this, arguments)
        .then(response => {
            if (!response.body || !response.ok) {
                ui.destroy();
                return response;
            }

            const total = parseInt(response.headers.get('content-length'), 10) || 0;

            if (total === 0) {
                ui.destroy();
                return response;
            }

            const reader = response.body.getReader();
            let loaded = 0;

            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) {
                                controller.close();
                                break;
                            }
                            loaded += value.length;
                            const percent = Math.round((loaded / total) * 100);
                            ui.update(percent);
                            controller.enqueue(value);
                        }
                        ui.destroy();
                    } catch (error) {
                        ui.destroy();
                        controller.error(error);
                    }
                }
            });

            return new Response(stream, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        })
        .catch(err => {
            ui.destroy();
            throw err;
        });
};
})();
