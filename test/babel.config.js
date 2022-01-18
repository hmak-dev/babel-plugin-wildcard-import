module.exports = (api) => {
    api.cache(true);

    return {
        presets: [['@babel/preset-env', { modules: 'cjs', targets: { node: true } }]],
        plugins: [
            [
                '../index.js',
                { changeExtensions: { enabled: process.env.NODE_ENV === 'production', extensions: { ts: 'js' } } },
            ],
        ],
    };
};
