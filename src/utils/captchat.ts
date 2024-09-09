export const solveCaptcha = async(captchaImageUrl: string, apiKey: string) => {
    const formData = new FormData();
    formData.append('method', 'base64');
    formData.append('key', apiKey);
    formData.append('body', captchaImageUrl);

    const response = await fetch('http://2captcha.com/in.php', {
        method: 'POST',
        body: formData
    });

    const captchaId = await response.text();

    await new Promise(resolve => setTimeout(resolve, 15000));

    const result = await fetch(`http://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}`);
    const captchaSolution = await result.text();

    return captchaSolution;
}
