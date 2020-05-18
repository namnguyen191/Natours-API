// type is 'success' or 'error'
export const showAlert = (type, msg, time = 7) => {
    hideAlert();
    const markUp = `<div class='alert alert--${type}'>${msg}</div>`;
    document.querySelector('body').insertAdjacentHTML('afterbegin', markUp);
    window.setTimeout(hideAlert, time * 1000);
};

export const hideAlert = () => {
    const el = document.querySelector('.alert');
    if (el) {
        el.parentElement.removeChild(el);
    }
};