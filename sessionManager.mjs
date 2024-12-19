class SessionManager {
    constructor(provider) {
        this.sessions = provider.sessions;
        this.currentIndex = 0;
        this.sessionConfigs = [];
        
        // 为每个会话创建唯一标识
        Object.entries(this.sessions).forEach(([username, session]) => {
            if (session.valid) {
                // 使用configIndex作为唯一标识
                this.sessionConfigs.push({
                    id: `${username}_${session.configIndex}`,
                    username: username,
                    configIndex: session.configIndex
                });
            }
        });
    }

    // 获取所有可用会话
    getAvailableSessions() {
        return this.sessionConfigs.map(config => config.id);
    }

    // 随机选择会话
    getRandomSession() {
        const availableSessions = this.getAvailableSessions();
        if (availableSessions.length === 0) {
            throw new Error('没有可用的会话');
        }
        const randomIndex = Math.floor(Math.random() * availableSessions.length);
        return availableSessions[randomIndex];
    }

    // 轮询策略
    getNextSession() {
        const availableSessions = this.getAvailableSessions();
        if (availableSessions.length === 0) {
            throw new Error('没有可用的会话');
        }
        const session = availableSessions[this.currentIndex % availableSessions.length];
        this.currentIndex = (this.currentIndex + 1) % availableSessions.length;
        return session;
    }

    // 从会话ID获取实际的用户名
    getUsernameFromSessionId(sessionId) {
        const sessionConfig = this.sessionConfigs.find(config => config.id === sessionId);
        return sessionConfig ? sessionConfig.username : null;
    }

    // 策略
    getSessionByStrategy(strategy = 'round-robin') {
        switch (strategy) {
            case 'round-robin':
                return this.getNextSession();
            case 'random':
                return this.getRandomSession();
            default:
                throw new Error(`未实现的策略: ${strategy}`);
        }
    }
}

export default SessionManager;