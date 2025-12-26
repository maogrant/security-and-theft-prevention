(function() {
    if (typeof jQuery === 'undefined') {
        console.error("[Hakimi] 缺少 jQuery");
        return;
    }
    
    jQuery(async function() {
        if (typeof SillyTavern === 'undefined') {
            console.error("[Hakimi] 缺少 SillyTavern");
            return;
        }
        
        // 🔧 调试开关：生产环境设置为 false
        const DEBUG = false;
        
        // 后端API地址
        const BACKEND_URL = 'https://st.givesalpha.org';
        
        function debugLog(...args) {
            if (DEBUG) console.log('[Hakimi]', ...args);
        }
        
        debugLog("插件已加载 v1.2");

        const indicator = document.createElement('div');
        indicator.id = 'hakimi-indicator';
        document.body.appendChild(indicator);
        
        if (!localStorage.getItem('hakimi_installed_alert')) {
            alert("✅ 哈基米八层加密插件安装成功！");
            localStorage.setItem('hakimi_installed_alert', 'true');
        }

        let isReloading = false;

        // ============ 后端授权请求 ============
        
        async function requestBackendAuth(deviceCode, characterName) {
            try {
                debugLog('🔑 请求后端授权:', deviceCode, characterName);
                
                const response = await fetch(`${BACKEND_URL}/api/auth/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceCode, characterName })
                });
                
                const data = await response.json();
                
                // 检查系统状态
                if (data.mode === 'locked') {
                    console.error('[Hakimi] 系统已锁定，禁止解密');
                    alert('⚠️ 系统检测到外部攻击，已锁定所有解密功能\n\n' + data.reason + '\n\n请联系管理员解决');
                    return { authorized: false, locked: true };
                }
                
                if (data.mode === 'degraded') {
                    console.warn('[Hakimi] 后端故障，使用本地解密');
                    return { authorized: true, degraded: true };
                }
                
                if (response.ok && data.success && data.authorized) {
                    debugLog('✅ 后端授权成功');
                    
                    // 缓存授权状态
                    if (data.needCache) {
                        const cacheKey = `hakimi_auth_${deviceCode}_${characterName}`;
                        localStorage.setItem(cacheKey, JSON.stringify({
                            authorized: true,
                            timestamp: Date.now()
                        }));
                    }
                    
                    return { authorized: true };
                }
                
                // 授权失败，返回详细信息
                return {
                    authorized: false,
                    action: data.action,
                    reason: data.message,
                    abnormalCount: data.abnormalCount
                };
                
            } catch (error) {
                console.error('[Hakimi] 后端请求失败:', error);
                // 网络错误时，允许本地解密（离线模式）
                return { authorized: true, offline: true };
            }
        }
        
        // 上报解密监控
        async function reportDecryptMonitor(deviceCode, characterName) {
            try {
                await fetch(`${BACKEND_URL}/api/decrypt/monitor`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceCode, characterName })
                });
            } catch (error) {
                // 静默失败
                debugLog('监控上报失败:', error);
            }
        }
        
        // 检查缓存的授权状态
        function checkCachedAuth(deviceCode, characterName) {
            try {
                const cacheKey = `hakimi_auth_${deviceCode}_${characterName}`;
                const cached = localStorage.getItem(cacheKey);
                
                if (cached) {
                    const data = JSON.parse(cached);
                    // 缓存有30天有效
                    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                    if (Date.now() - data.timestamp < thirtyDays) {
                        return true;
                    }
                }
                
                return false;
            } catch (error) {
                return false;
            }
        }

        // ============ 工具函数：安全的字节转字符串 ============
        
        function bytesToString(bytes) {
            // 分块处理，避免栈溢出
            const CHUNK_SIZE = 8192;
            let result = '';
            const arr = bytes instanceof Uint8Array ? bytes : 
                        (bytes instanceof Uint16Array ? bytes : Array.from(bytes));
            for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
                const end = Math.min(i + CHUNK_SIZE, arr.length);
                const chunk = [];
                for (let j = i; j < end; j++) {
                    chunk.push(arr[j]);
                }
                result += String.fromCharCode.apply(null, chunk);
            }
            return result;
        }

                        // 预计算模逆元表
        const modInverseTable = {};
        for (let a = 1; a < 256; a += 2) {
            for (let x = 1; x < 256; x++) {
                if ((a * x) % 256 === 1) {
                    modInverseTable[a] = x;
                    break;
                }
            }
        }

                function safeDecrypt(encodedStr) {
            try {
                if (!encodedStr || typeof encodedStr !== 'string') return null;
                debugLog("开始八层解密...");
                return decodeEightLayers(encodedStr);
            } catch (e) { 
                console.error("[Hakimi] 解密失败:", e); 
                return null; 
            }
        }

                                function decodeEightLayers(data) {
            let layerCount = 0;
            let result = data;
            
                        debugLog("开始八层解密...");
            
            try {
                
                // 安全检查输入
                if (!result || typeof result !== 'string' || result.length === 0) {
                    console.error("[Hakimi] 输入数据无效");
                    return null;
                }
                
                                // 第1层：移除保护层
                layerCount++;
                const lines = data.split('\n');
                const startIndex = lines.findIndex(l => l.includes('=== DATA START ==='));
                const endIndex = lines.findIndex(l => l.includes('=== DATA END ==='));
                
                if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                    result = lines.slice(startIndex + 1, endIndex).join('\n');
                }
                
                if (!result || result.trim().length === 0) {
                    console.error("[Hakimi] 提取后数据为空");
                    return null;
                }
                
                                // 第2层：移除校验和
                layerCount++;
                result = removeChecksum(result);
                
                                                // 第3层：跳过Unicode去混淆（已在加密时禁用）
                layerCount++;
                
                                                                // 第4层：Base91解码
                layerCount++;
                
                                                result = base91Decode(result);
                if (!result || result.length === 0) {
                    console.error("[Hakimi] Base91解码失败");
                    return null;
                }
                
                                                // 第5层：栅栏解密
                layerCount++;
                result = railFenceDecipher(result, 4);
                
                                                // 第6层：XOR解密
                layerCount++;
                result = xorChainReverse(result, 3);
                
                                                // 第7层：斐波那契反洗牌
                layerCount++;
                result = fibonacciUnshuffle(result, 2);
                
                                                // 第8层：矩阵逆变换
                layerCount++;
                result = matrixTransformReverse(result, 1);
                
                                                                                                        // 第9层：字节逆变换
                layerCount++;
                result = byteTransformReverse(result, 0);
                
                                                                                // 清理并解析JSON
                const jsonStart = result.indexOf('{');
                const jsonEnd = result.lastIndexOf('}');
                
                if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
                    console.error("[Hakimi] 无法找到JSON边界");
                    return null;
                }
                
                                                const jsonStr = result.substring(jsonStart, jsonEnd + 1);
                
                                let jsonData;
                try {
                    jsonData = JSON.parse(jsonStr);
                } catch (e1) {
                    try {
                        jsonData = JSON.parse(jsonStr.trim());
                    } catch (e2) {
                        try {
                            const lastDoubleBrace = jsonStr.lastIndexOf('}}');
                            if (lastDoubleBrace !== -1) {
                                jsonData = JSON.parse(jsonStr.substring(0, lastDoubleBrace + 2));
                            } else {
                                throw e1;
                            }
                        } catch (e3) {
                            // 尝试括号匹配截断
                            let braceCount = 0;
                            let inString = false;
                            let escapeNext = false;
                            let jsonEndPos = -1;
                            
                            for (let i = 0; i < jsonStr.length; i++) {
                                const char = jsonStr[i];
                                if (escapeNext) {
                                    escapeNext = false;
                                    continue;
                                }
                                if (char === '\\' && inString) {
                                    escapeNext = true;
                                    continue;
                                }
                                if (char === '"' && !escapeNext) {
                                    inString = !inString;
                                    continue;
                                }
                                if (!inString) {
                                    if (char === '{') braceCount++;
                                    else if (char === '}') {
                                        braceCount--;
                                        if (braceCount === 0) {
                                            jsonEndPos = i;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            if (jsonEndPos !== -1) {
                                try {
                                    jsonData = JSON.parse(jsonStr.substring(0, jsonEndPos + 1));
                                } catch (e4) {
                                    throw e1;
                                }
                            } else {
                                throw e1;
                            }
                        }
                    }
                }
                
                                                // 清理元数据
                delete jsonData._format;
                delete jsonData._version;
                delete jsonData._timestamp;
                delete jsonData._encoder;
                delete jsonData._watermark;
                
                // 删除 DRM 标记，防止再次导出时误判
                if (jsonData.extensions) {
                    delete jsonData.extensions.hakimi_drm;
                }
                if (jsonData.data?.extensions) {
                    delete jsonData.data.extensions.hakimi_drm;
                }
                
                                debugLog("解密完成:", jsonData.name || jsonData.data?.name);
                return jsonData;
                
                        } catch (e) {
                console.error("[Hakimi] 解密失败于第", layerCount, "层:", e.message);
                return null;
            }
        }

                function removeChecksum(str) {
            // 🔧 修复：正确计算原始长度和间隔
            const originalLength = str.length - 12; // 减去12个校验字符
            const interval = Math.max(3, Math.floor(originalLength / 12));
            let result = '';
            let checksumCount = 0;
            let originalIndex = 0;
            
            for (let i = 0; i < str.length; i++) {
                result += str[i];
                originalIndex++;
                
                // 跳过校验字符（在每个 interval 的倍数位置后面）
                if (originalIndex % interval === 0 && checksumCount < 12 && i + 1 < str.length) {
                    i++; // 跳过下一个字符（校验字符）
                    checksumCount++;
                }
            }
            return result;
        }

                                        function base91Decode(str) {
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";
            const result = [];
            let buffer = 0;
            let bits = 0;
            let v = -1;
            
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                const index = alphabet.indexOf(char);
                
                if (index === -1) continue;
                
                if (v < 0) {
                    v = index;
                } else {
                    v += index * 91;
                    buffer |= v << bits;
                    bits += (v & 8191) > 88 ? 13 : 14;
                    
                    while (bits > 7) {
                        result.push(buffer & 255);
                        buffer >>= 8;
                        bits -= 8;
                    }
                    v = -1;
                }
            }
            
            if (v >= 0) {
                result.push((buffer | (v << bits)) & 255);
            }
            
            return new Uint8Array(result);
        }

                function railFenceDecipher(input, layerIndex) {
            // 🔧 支持 Uint8Array 输入
            const isUint8 = input instanceof Uint8Array;
            const length = input.length;
            const rails = 3 + (layerIndex % 5);
            const fence = new Array(rails).fill().map(() => []);
            
            const railLengths = new Array(rails).fill(0);
            let rail = 0, direction = 1;
            
            for (let i = 0; i < length; i++) {
                railLengths[rail]++;
                rail += direction;
                if (rail === 0 || rail === rails - 1) direction = -direction;
            }
            
            let index = 0;
            for (let r = 0; r < rails; r++) {
                for (let i = 0; i < railLengths[r]; i++) {
                    fence[r].push(input[index++]);
                }
            }
            
            const result = isUint8 ? new Uint8Array(length) : '';
            rail = 0;
            direction = 1;
            const fenceIndices = new Array(rails).fill(0);
            
            if (isUint8) {
                for (let i = 0; i < length; i++) {
                    result[i] = fence[rail][fenceIndices[rail]++];
                    rail += direction;
                    if (rail === 0 || rail === rails - 1) direction = -direction;
                }
            } else {
                let strResult = '';
                for (let i = 0; i < length; i++) {
                    strResult += fence[rail][fenceIndices[rail]++];
                    rail += direction;
                    if (rail === 0 || rail === rails - 1) direction = -direction;
                }
                return strResult;
            }
            
            return result;
        }

                        function xorChainReverse(input, layerIndex) {
            // 🔧 支持 Uint8Array 和字符串输入
            const bytes = input instanceof Uint8Array ? input : (() => {
                const arr = new Uint8Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    arr[i] = input.charCodeAt(i) & 0xFF;
                }
                return arr;
            })();
            const key = generateKey(layerIndex, bytes.length);
                        const result = new Uint8Array(bytes.length);
            
            let prevByte = key[0];
            for (let i = 0; i < bytes.length; i++) {
                let transformedByte = bytes[i];
                
                // 🔧 移除非线性变换（不可逆）
                result[i] = transformedByte ^ prevByte ^ key[i % key.length];
                prevByte = (bytes[i] + i) % 256;
            }
            
            // 🔧 返回 Uint8Array
            return result;
        }

                                                        function fibonacciUnshuffle(input, layerIndex) {
            const len = input.length;
            const chars = input instanceof Uint8Array ? new Uint8Array(input) : (() => {
                const arr = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    arr[i] = input.charCodeAt(i) & 0xFF;
                }
                return arr;
            })();
            
            const fibLen = Math.min(len, 1000);
            const fib = generateFibonacci(fibLen);
            
            // 完全匹配 HTML 加密器的逻辑
                        // 先收集所有交换操作
                        const swapOperations = [];
            for (let round = 0; round < 3; round++) {
                for (let i = 1; i < len; i++) {
                    const fibIndex = i % fib.length;
                    const swapWith = (i + fib[fibIndex]) % len;
                    if (swapWith !== i) {
                        swapOperations.push([i, swapWith]);
                    }
                }
            }
            
            // 按相反顺序执行交换
            for (let idx = swapOperations.length - 1; idx >= 0; idx--) {
                const [i, swapWith] = swapOperations[idx];
                const temp = chars[i];
                chars[i] = chars[swapWith];
                chars[swapWith] = temp;
            }
            
            return chars;
        }

                        // 🔧 修复：完整的矩阵逆变换
        function matrixTransformReverse(input, layerIndex) {
            const matrixSize = 5;
            // 🔧 支持 Uint8Array 和字符串输入
            const bytes = input instanceof Uint8Array ? input : (() => {
                const arr = new Uint8Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    arr[i] = input.charCodeAt(i) & 0xFF;
                }
                return arr;
            })();
            const originalLength = bytes.length;  // 🔧 保存原始长度
            const paddedLength = Math.ceil(bytes.length / (matrixSize * matrixSize)) * (matrixSize * matrixSize);
            
            // 🔧 关键修复：如果输入长度不是25的倍数，需要填充到25的倍数
            const paddedBytes = new Uint8Array(paddedLength);
            paddedBytes.set(bytes);  // 复制原始数据，剩余部分自动填充为0
            
            const result = new Uint8Array(paddedLength);
            const matrixCount = paddedLength / (matrixSize * matrixSize);
            
                        
            
            const transformationMatrix = [
                [3, 5, 7, 11, 13],
                [17, 19, 23, 29, 31],
                [37, 41, 43, 47, 53],
                [59, 61, 67, 71, 73],
                [79, 83, 89, 97, 101]
            ];
            
                        const multipliers = [
                [3, 5, 7, 9, 11],
                [13, 15, 17, 19, 21],
                [23, 25, 27, 29, 31],
                [33, 35, 37, 39, 41],
                [43, 45, 47, 49, 51]
            ];
            
                        for (let m = 0; m < matrixCount; m++) {
                const startIdx = m * matrixSize * matrixSize;
                const matrix = new Array(matrixSize).fill(0).map(() => new Array(matrixSize).fill(0));
                
                // 🔧 关键修复：使用 paddedBytes 而不是 bytes
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        const idx = startIdx + i * matrixSize + j;
                        matrix[i][j] = paddedBytes[idx];  // 直接使用填充后的数据
                    }
                }
                
                                const unrotated = spiralUnrotate(matrix);
                
                // 🔧 逆向乘法和加法
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        let val = unrotated[i][j];
                        
                        // 逆向乘法（使用模逆元）
                        const mult = multipliers[i][j];
                        if (modInverseTable[mult]) {
                            val = (val * modInverseTable[mult]) % 256;
                        }
                        
                        // 逆向加法
                        val = (val - transformationMatrix[i][j] + 256) % 256;
                        
                        unrotated[i][j] = val;
                    }
                }
                
                // 🔧 逆向转置
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = i + 1; j < matrixSize; j++) {
                        [unrotated[i][j], unrotated[j][i]] = [unrotated[j][i], unrotated[i][j]];
                    }
                }
                
                                                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        const idx = startIdx + i * matrixSize + j;
                        result[idx] = unrotated[i][j];
                    }
                }
                
                                                
            }
            
                                                            return result;
        }

                                                                        // ✅ 已验证：螺旋旋转是自逆的
        function spiralUnrotate(matrix) {
            return spiralRotate(matrix);
        }
        
        function spiralRotate(matrix) {
            const size = matrix.length;
            const result = new Array(size).fill(0).map(() => new Array(size).fill(0));
            let top = 0, bottom = size - 1, left = 0, right = size - 1;
            let values = [];
            
            // 顺时针收集
            while (top <= bottom && left <= right) {
                for (let i = left; i <= right; i++) values.push(matrix[top][i]);
                top++;
                for (let i = top; i <= bottom; i++) values.push(matrix[i][right]);
                right--;
                if (top <= bottom) {
                    for (let i = right; i >= left; i--) values.push(matrix[bottom][i]);
                    bottom--;
                }
                if (left <= right) {
                    for (let i = bottom; i >= top; i--) values.push(matrix[i][left]);
                    left++;
                }
            }
            
            // 反转后顺时针填充
            values = values.reverse();
            let index = 0;
            top = 0; bottom = size - 1; left = 0; right = size - 1;
            
            while (top <= bottom && left <= right && index < values.length) {
                for (let i = left; i <= right && index < values.length; i++) result[top][i] = values[index++];
                top++;
                for (let i = top; i <= bottom && index < values.length; i++) result[i][right] = values[index++];
                right--;
                if (top <= bottom) {
                    for (let i = right; i >= left && index < values.length; i--) result[bottom][i] = values[index++];
                    bottom--;
                }
                if (left <= right) {
                    for (let i = bottom; i >= top && index < values.length; i--) result[i][left] = values[index++];
                    left++;
                }
            }
            return result;
        }

                                                                                                        function byteTransformReverse(input, layerIndex) {
            const encryptedBytes = input instanceof Uint8Array ? input : (() => {
                const arr = new Uint8Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    arr[i] = input.charCodeAt(i) & 0xFF;
                }
                return arr;
            })();
            
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
            
                                    // 第一步：逆向相邻字节互动
            const step1 = new Uint8Array(encryptedBytes.length);
            
                        for (let i = 0; i < encryptedBytes.length; i++) {
                let byte = encryptedBytes[i];
                
                if (i > 0) {
                    byte ^= step1[i - 1] & 0x0F;
                    byte ^= encryptedBytes[i - 1] & 0xF0;
                }
                
                step1[i] = byte;
            }
            
                        // 第二步：逆向主要变换
            const result = new Uint8Array(encryptedBytes.length);
            
                        for (let i = 0; i < encryptedBytes.length; i++) {
                let byte = step1[i];
                
                const shift = (i % 7) + 1;
                byte = ((byte >> shift) | (byte << (8 - shift))) & 0xFF;
                
                const prime = primes[i % primes.length];
                const layerFactor = (layerIndex + 1) * 17;
                byte = (byte - prime - layerFactor + 256 * 100) % 256;
                
                const positionFactor = (i * 13) % 256;
                byte ^= positionFactor;
                
                result[i] = byte;
            }
            
                                                            // 去除尾部填充字节，找到JSON结束位置
            let actualLength = result.length;
            
                                                            // 使用括号匹配查找JSON结束位置
            
            let braceCount = 0;
            let bracketCount = 0;
            let inString = false;
            let escapeNext = false;
            let jsonEndPos = -1;
            
            for (let i = 0; i < result.length; i++) {
                const byte = result[i];
                const char = String.fromCharCode(byte);
                
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (byte === 0x5C && inString) {  // '\' in string
                    escapeNext = true;
                    continue;
                }
                
                if (byte === 0x22 && !escapeNext) {  // '"'
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (byte === 0x7B) braceCount++;  // '{'
                    else if (byte === 0x7D) {  // '}'
                        braceCount--;
                                            if (braceCount === 0 && bracketCount === 0) {
                            jsonEndPos = i;
                            actualLength = i + 1;
                            break;
                        }
                    }
                    else if (byte === 0x5B) bracketCount++;  // '['
                    else if (byte === 0x5D) bracketCount--;  // ']'
                }
            }
            
                        if (jsonEndPos === -1) {
                for (let i = result.length - 1; i >= 0; i--) {
                    if (result[i] === 0x7D) {
                        actualLength = i + 1;
                        break;
                    }
                }
            }
            
            
            
                                                            let finalResult = result;
            if (actualLength < result.length) {
                finalResult = result.slice(0, actualLength);
            }
            
                                    try {
                return new TextDecoder('utf-8', { fatal: true }).decode(finalResult);
            } catch (e) {
                try {
                    return new TextDecoder('utf-8', { fatal: false }).decode(finalResult);
                } catch (e2) {
                    // 降级到Latin-1
                    let fallback = '';
                    for (let i = 0; i < finalResult.length; i++) {
                        fallback += String.fromCharCode(finalResult[i]);
                    }
                    return fallback;
                }
            }
        }

        function generateKey(layerIndex, length) {
            const seed = 3141592653 + layerIndex * 1000007;
            const key = new Uint8Array(length);
            
            for (let i = 0; i < length; i++) {
                // 使用安全的位运算，避免溢出
                let x = ((seed >>> 0) + (i * 2654435761 >>> 0)) >>> 0;
                x = (x ^ (x >>> 13)) >>> 0;
                x = (x ^ (x << 17)) >>> 0;
                x = (x ^ (x >>> 5)) >>> 0;
                key[i] = x & 255;
            }
            
            return key;
        }

        function generateFibonacci(length) {
            // 限制长度避免数字溢出
            const maxLen = Math.min(length, 1000);
            const fib = [1, 1];
            while (fib.length < maxLen) {
                // 使用取模防止数字过大
                const next = (fib[fib.length - 1] + fib[fib.length - 2]) % 1000000007;
                fib.push(next);
            }
            return fib.slice(0, maxLen);
        }

        // ============ 加密函数（导出时使用）============

        function encodeEightLayers(jsonData) {
            try {
                // 添加元数据
                const dataWithMeta = {
                    ...jsonData,
                    _format: 'HAKIMI_8LAYER',
                    _version: 'v12.1',
                    _timestamp: Date.now(),
                    _encoder: 'Hakimi_Plugin',
                    _watermark: 'Protected'
                };
                
                                                let result = JSON.stringify(dataWithMeta);
                debugLog("开始八层加密...");
                
                // 第1层：字节变换
                result = byteTransformForward(result, 0);
                
                // 第2层：矩阵变换
                result = matrixTransformForward(result, 1);
                
                                // 第3层：斐波那契洗牌
                result = fibonacciShuffle(result, 2);
                
                // 第4层：XOR链式加密
                result = xorChainForward(result, 3);
                
                // 第5层：栅栏加密
                result = railFenceCipher(result, 4);
                
                // 第6层：Base91编码
                result = base91Encode(result);
                
                // 第7层：跳过Unicode混淆（防止被过滤）
                
                // 第8层：添加校验和
                result = addChecksum(result);
                
                                                // 添加保护层标记
                result = '=== DATA START ===\n' + result + '\n=== DATA END ===';
                
                return result;
                        } catch (e) {
                console.error("[Hakimi] 加密失败:", e);
                return null;
            }
        }

                                function byteTransformForward(str, layerIndex) {
                        const bytes = new TextEncoder().encode(str);
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
            
            // 第一步：主要变换
            const step1 = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
                let byte = bytes[i];
                
                // XOR
                const positionFactor = (i * 13) % 256;
                byte ^= positionFactor;
                
                // 加法
                const prime = primes[i % primes.length];
                const layerFactor = (layerIndex + 1) * 17;
                byte = (byte + prime + layerFactor) % 256;
                
                // 循环移位
                const shift = (i % 7) + 1;
                byte = ((byte << shift) | (byte >> (8 - shift))) & 0xFF;
                
                                step1[i] = byte;
            }
            
            // 第二步：相邻字节互动
            const result = new Uint8Array(bytes.length);
                        for (let i = 0; i < bytes.length; i++) {
                let byte = step1[i];
                
                if (i > 0) {
                    byte ^= step1[i - 1] & 0x0F;
                    byte ^= result[i - 1] & 0xF0;
                }
                
                result[i] = byte;
            }
            
            return result;
        }

                                        function matrixTransformForward(input, layerIndex) {
            const matrixSize = 5;
            const bytes = input instanceof Uint8Array ? input : (() => {
                const arr = new Uint8Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    arr[i] = input.charCodeAt(i) & 0xFF;
                }
                return arr;
            })();
            
            const paddedLength = Math.ceil(bytes.length / (matrixSize * matrixSize)) * (matrixSize * matrixSize);
            const paddedBytes = new Uint8Array(paddedLength);
            paddedBytes.set(bytes);
            
            const result = new Uint8Array(paddedLength);
            const matrixCount = paddedLength / (matrixSize * matrixSize);
            
            const transformationMatrix = [
                [3, 5, 7, 11, 13],
                [17, 19, 23, 29, 31],
                [37, 41, 43, 47, 53],
                [59, 61, 67, 71, 73],
                [79, 83, 89, 97, 101]
            ];
            
            const multipliers = [
                [3, 5, 7, 9, 11],
                [13, 15, 17, 19, 21],
                [23, 25, 27, 29, 31],
                [33, 35, 37, 39, 41],
                [43, 45, 47, 49, 51]
            ];
            
            for (let m = 0; m < matrixCount; m++) {
                const startIdx = m * matrixSize * matrixSize;
                const matrix = new Array(matrixSize).fill(0).map(() => new Array(matrixSize).fill(0));
                
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        const idx = startIdx + i * matrixSize + j;
                        matrix[i][j] = paddedBytes[idx];
                    }
                }
                
                // 转置
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = i + 1; j < matrixSize; j++) {
                        [matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]];
                    }
                }
                
                // 加法和乘法
                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        let val = matrix[i][j];
                        val = (val + transformationMatrix[i][j]) % 256;
                        val = (val * multipliers[i][j]) % 256;
                        matrix[i][j] = val;
                    }
                }
                
                // 螺旋旋转
                const rotated = spiralRotate(matrix);
                
                                for (let i = 0; i < matrixSize; i++) {
                    for (let j = 0; j < matrixSize; j++) {
                        const idx = startIdx + i * matrixSize + j;
                        result[idx] = rotated[i][j];
                    }
                                }
            }
            
            return result;
        }

        function spiralRotate(matrix) {
            const size = matrix.length;
            const result = new Array(size).fill(0).map(() => new Array(size).fill(0));
            
            let top = 0, bottom = size - 1;
            let left = 0, right = size - 1;
            let values = [];
            
            // 按顺时针螺旋收集
            while (top <= bottom && left <= right) {
                for (let i = left; i <= right; i++) values.push(matrix[top][i]);
                top++;
                for (let i = top; i <= bottom; i++) values.push(matrix[i][right]);
                right--;
                if (top <= bottom) {
                    for (let i = right; i >= left; i--) values.push(matrix[bottom][i]);
                    bottom--;
                }
                if (left <= right) {
                    for (let i = bottom; i >= top; i--) values.push(matrix[i][left]);
                    left++;
                }
            }
            
            // 反转后按逆时针螺旋填充
            values = values.reverse();
            let index = 0;
            top = 0; bottom = size - 1;
            left = 0; right = size - 1;
            
            while (top <= bottom && left <= right && index < values.length) {
                for (let i = left; i <= right && index < values.length; i++) {
                    result[top][i] = values[index++];
                }
                top++;
                for (let i = top; i <= bottom && index < values.length; i++) {
                    result[i][right] = values[index++];
                }
                right--;
                if (top <= bottom) {
                    for (let i = right; i >= left && index < values.length; i--) {
                        result[bottom][i] = values[index++];
                    }
                    bottom--;
                }
                if (left <= right) {
                    for (let i = bottom; i >= top && index < values.length; i--) {
                        result[i][left] = values[index++];
                    }
                    left++;
                }
            }
            
            return result;
        }

                                        function fibonacciShuffle(input, layerIndex) {
            const chars = input instanceof Uint8Array ? new Uint8Array(input) : (() => {
                const arr = new Uint8Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    arr[i] = input.charCodeAt(i) & 0xFF;
                }
                return arr;
            })();
                        const len = chars.length;
            const fibLen = Math.min(len, 1000);
            const fib = generateFibonacci(fibLen);
            
            for (let round = 0; round < 3; round++) {
                for (let i = 1; i < len; i++) {
                    const fibIndex = i % fib.length;
                    const swapWith = (i + fib[fibIndex]) % len;
                    if (swapWith !== i) {
                        const temp = chars[i];
                        chars[i] = chars[swapWith];
                        chars[swapWith] = temp;
                    }
                                }
            }
            
            return chars;
        }

                                                                        function xorChainForward(input, layerIndex) {
            const bytes = input instanceof Uint8Array ? input : (() => {
                const arr = new Uint8Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    arr[i] = input.charCodeAt(i) & 0xFF;
                }
                return arr;
            })();
            const key = generateKey(layerIndex, bytes.length);
            const result = new Uint8Array(bytes.length);
            
            let prevByte = key[0];
                        for (let i = 0; i < bytes.length; i++) {
                let transformedByte = bytes[i] ^ prevByte ^ key[i % key.length];
                result[i] = transformedByte;
                prevByte = (result[i] + i) % 256;
            }
            
            return result;
        }

                        function railFenceCipher(input, layerIndex) {
            const bytes = input instanceof Uint8Array ? input : (() => {
                return new Uint8Array(Array.from(input).map(c => typeof c === 'string' ? c.charCodeAt(0) : c));
            })();
            
            const rails = 3 + (layerIndex % 5);
            const fence = new Array(rails).fill().map(() => []);
            
            let rail = 0, direction = 1;
            for (let i = 0; i < bytes.length; i++) {
                fence[rail].push(bytes[i]);
                rail += direction;
                if (rail === 0 || rail === rails - 1) direction = -direction;
            }
            
            // 合并所有轨道的字节
            const result = new Uint8Array(bytes.length);
            let index = 0;
            for (let r = 0; r < rails; r++) {
                for (let i = 0; i < fence[r].length; i++) {
                                        result[index++] = fence[r][i];
                }
            }
            return result;
        }

                                        function base91Encode(input) {
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";
            const bytes = input instanceof Uint8Array ? input : (() => {
                const arr = new Uint8Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    arr[i] = input.charCodeAt(i) & 0xFF;
                }
                return arr;
            })();
            
            let result = '';
            let buffer = 0;
            let bits = 0;
            
            for (let i = 0; i < bytes.length; i++) {
                buffer |= bytes[i] << bits;
                bits += 8;
                
                if (bits > 13) {
                    let val = buffer & 8191;
                    if (val > 88) {
                        buffer >>= 13;
                        bits -= 13;
                    } else {
                        val = buffer & 16383;
                        buffer >>= 14;
                        bits -= 14;
                    }
                    result += alphabet[val % 91] + alphabet[Math.floor(val / 91)];
                }
            }
            
            if (bits > 0) {
                result += alphabet[buffer % 91];
                if (bits > 7 || buffer > 90) {
                    result += alphabet[Math.floor(buffer / 91)];
                }
            }
            
            return result;
        }

        function addUnicodeObfuscation(str) {
            const zwChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
            let result = '';
            
            for (let i = 0; i < str.length; i++) {
                result += str[i];
                if (i % 7 === 0) {
                    result += zwChars[i % zwChars.length];
                }
            }
            
            return result;
        }

        function addChecksum(str) {
            const interval = Math.max(3, Math.floor(str.length / 12));
            let result = '';
            let checksumCount = 0;
            let charIndex = 0;
            
            for (let i = 0; checksumCount < 12 && charIndex < str.length; i++) {
                if (i % interval === interval - 1 && checksumCount < 12) {
                    // 插入校验字符
                    const checkChar = String.fromCharCode(65 + (charIndex % 26));
                    result += checkChar;
                    checksumCount++;
                }
                if (charIndex < str.length) {
                    result += str[charIndex++];
                }
            }
            
            // 添加剩余字符
            result += str.slice(charIndex);
            
            return result;
        }

                // 保存原始角色数据用于导出时加密
        const originalEncryptedData = new Map();
        
        // 记录已解密的角色ID
        function markDecrypted(charId, originalPayload) {
            originalEncryptedData.set(charId, originalPayload);
        }
        
        function getOriginalPayload(charId) {
            return originalEncryptedData.get(charId);
        }
        
        // 🔧 内存清理机制：定期清理已卸载角色的缓存数据
        function cleanupOldData() {
            try {
                const context = SillyTavern?.getContext?.();
                if (!context || !context.characters) return;
                
                const activeCharIds = new Set();
                context.characters.forEach((char, index) => {
                    if (char) activeCharIds.add(index);
                });
                
                let cleanedCount = 0;
                for (const [id] of originalEncryptedData) {
                    if (!activeCharIds.has(id)) {
                        originalEncryptedData.delete(id);
                        cleanedCount++;
                    }
                }
                
                if (cleanedCount > 0) {
                    debugLog(`清理了 ${cleanedCount} 个过期角色缓存`);
                }
            } catch (e) {
                console.error('[Hakimi] 内存清理失败:', e);
            }
        }
        
        // 每5分钟执行一次清理
        setInterval(cleanupOldData, 300000);
        
        // 页面卸载时清理所有数据
        window.addEventListener('beforeunload', () => {
            originalEncryptedData.clear();
            debugLog('已清理所有缓存数据');
        });

        function safeToast(type, message, title) {
            if (typeof toastr !== 'undefined' && toastr[type]) {
                toastr[type](message, title);
            } else {
                console.log(`[${title}] ${message}`);
            }
        }

                async function interceptAndReload() {
            if (isReloading) return;

            const context = SillyTavern.getContext();
            const charId = context.characterId;
            
            if (!charId || !context.characters[charId]) return;

                        const charObj = context.characters[charId];
            
                                    // 检查扩展数据位置（支持不同版本的 SillyTavern）
            const extensions = charObj.data?.extensions || charObj.extensions;
            
            

                                    // 检查 extensions 存储（新格式）
                                    if (extensions?.hakimi_drm?.chunks) {
                
                                const drm = extensions.hakimi_drm;
                
                // 合并分块
                let raw = drm.chunks.join('');
                                // 如果数据不包含保护层标记，手动添加
                                if (!raw.includes('=== DATA START ===')) {
                    raw = '=== DATA START ===\n' + raw + '\n=== DATA END ===';
                }
                
                // 🔑 后端授权检查
                const deviceCode = drm.device_code;
                const characterName = charObj.name || charObj.data?.name || 'Unknown';
                
                if (deviceCode) {
                    // 检查缓存
                    const isCached = checkCachedAuth(deviceCode, characterName);
                    
                    if (!isCached) {
                        // 首次解密，请求后端授权
                        const authResult = await requestBackendAuth(deviceCode, characterName);
                        
                        // 系统锁定
                        if (authResult.locked) {
                            console.error('[Hakimi] 系统锁定，禁止解密');
                            return;
                        }
                        
                        if (!authResult.authorized) {
                            console.error('[Hakimi] 后端授权失败，拒绝解密');
                            
                            // 判断是否为冷却期或永久禁用
                            if (authResult.action === 'cooldown') {
                                safeToast('warning', `⏱️ 触发频率限制，请稍后再试`, "Hakimi DRM");
                            } else if (authResult.action === 'permanent_ban') {
                                safeToast('error', `❌ ${characterName} 已永久禁用`, "Hakimi DRM");
                            } else {
                                safeToast('error', `❌ ${characterName} 授权失败`, "Hakimi DRM");
                            }
                            return;
                        }
                        
                        // 降级模式提示
                        if (authResult.degraded) {
                            safeToast('info', `🛠️ 后端故障，使用本地解密`, "Hakimi DRM");
                        }
                    } else {
                        // 已缓存，上报监控
                        reportDecryptMonitor(deviceCode, characterName);
                    }
                }
                
                const decrypted = safeDecrypt(raw);

                if (decrypted && (decrypted.name || decrypted.data?.name)) {
                    const realData = decrypted.data || decrypted;
                    
                    // 保存原始加密数据
                    markDecrypted(charId, raw);

                                        // 复制字段列表
                    const fieldsToCopy = [
                        'name', 'description', 'personality', 'first_mes', 'mes_example',
                        'scenario', 'system_prompt', 'post_history_instructions', 'tags',
                        'creator', 'character_version', 'talkativeness', 'fav',
                        'depth_prompt_prompt', 'depth_prompt_depth', 'depth_prompt_role'
                    ];
                    
                                                            // 复制所有存在的字段
                    fieldsToCopy.forEach(field => {
                        if (realData[field] !== undefined) {
                            charObj[field] = realData[field];
                        }
                    });
                    
                    // 合并 extensions，但删除 hakimi_drm
                    const cleanExtensions = { ...(realData.extensions || {}) };
                    delete cleanExtensions.hakimi_drm;
                    charObj.extensions = { ...charObj.extensions, ...cleanExtensions };
                    
                                        // 处理 character_book（支持深拷贝和多种格式）
                    if (realData.character_book) {
                        charObj.character_book = JSON.parse(JSON.stringify(realData.character_book));
                    } else if (realData.world_info) {
                        charObj.character_book = JSON.parse(JSON.stringify(realData.world_info));
                    } else {
                        charObj.character_book = null;
                    }
                    
                    charObj.alternate_greetings = realData.alternate_greetings || [];
                    charObj.creator_notes = realData.creator_notes || "Decrypted by Hakimi";
                    
                    if (charObj.data) {
                        fieldsToCopy.forEach(field => {
                            if (realData[field] !== undefined) {
                                charObj.data[field] = realData[field];
                            }
                        });
                        charObj.data.extensions = { ...charObj.data.extensions, ...(realData.extensions || {}) };
                        charObj.data.character_book = charObj.character_book;
                        charObj.data.alternate_greetings = charObj.alternate_greetings;
                        charObj.data.creator_notes = charObj.creator_notes;
                    }

                                                                                                                                                                                                                                                                                                                                                                                                  safeToast('success', `🔓 ${realData.name} 解锁完成`, "Hakimi DRM");
                }
                return;
            }

                        // 兼容旧格式（creator_notes）
            if (charObj.creator_notes && charObj.creator_notes.includes("HAKIMI_8LAYER::")) {
                
                const parts = charObj.creator_notes.split("HAKIMI_8LAYER::");
                if (parts.length < 2 || !parts[1]) {
                    console.warn("[Hakimi] 格式无效");
                    return;
                }
                
                                const raw = parts[1].trim();
                const decrypted = safeDecrypt(raw);

                if (decrypted && (decrypted.name || decrypted.data?.name)) {
                    const realData = decrypted.data || decrypted;
                    
                    // 保存原始加密数据
                    markDecrypted(charId, raw);

                                                            // 复制字段列表，确保所有角色卡信息都能正确解密
                    const fieldsToCopy = [
                        'name', 'description', 'personality', 'first_mes', 'mes_example',
                        'scenario', 'system_prompt', 'post_history_instructions', 'tags',
                        'creator', 'character_version', 'talkativeness', 'fav',
                        'depth_prompt_prompt', 'depth_prompt_depth', 'depth_prompt_role'
                    ];
                    
                    // 复制所有存在的字段
                                        fieldsToCopy.forEach(field => {
                        if (realData[field] !== undefined) {
                            charObj[field] = realData[field];
                        }
                    });
                    
                    // 特殊字段处理
                    // 合并 extensions，但删除 hakimi_drm
                    const cleanExtensions = { ...(realData.extensions || {}) };
                    delete cleanExtensions.hakimi_drm;
                    charObj.extensions = { ...charObj.extensions, ...cleanExtensions };
                    
                    // 🔧 增强 character_book 处理：支持深拷贝和多种格式
                                        if (realData.character_book) {
                        charObj.character_book = JSON.parse(JSON.stringify(realData.character_book));
                    } else if (realData.world_info) {
                        charObj.character_book = JSON.parse(JSON.stringify(realData.world_info));
                    } else {
                        charObj.character_book = null;
                    }
                    
                    charObj.alternate_greetings = realData.alternate_greetings || [];
                    charObj.creator_notes = realData.creator_notes || "Decrypted by Hakimi";
                    
                    // 同步到data子对象
                    if (charObj.data) {
                        fieldsToCopy.forEach(field => {
                            if (realData[field] !== undefined) {
                                charObj.data[field] = realData[field];
                            }
                        });
                        charObj.data.extensions = { ...charObj.data.extensions, ...(realData.extensions || {}) };
                        charObj.data.character_book = charObj.character_book;
                        charObj.data.alternate_greetings = charObj.alternate_greetings;
                        charObj.data.creator_notes = charObj.creator_notes;
                    }

                                                                                                                                                                                                                                                                                                                                                                                                      safeToast('success', `🔓 ${realData.name} 解锁完成`, "Hakimi DRM");
                }
            }
        }

                                                        // 劫持 SillyTavern 的角色加载函数
        
                                                        function hookCharacterLoading() {
            // 劫持 getCharacters 函数
            const originalGetCharacters = window.getCharacters;
            if (originalGetCharacters) {
                window.getCharacters = async function(...args) {
                    const result = await originalGetCharacters.apply(this, args);
                    setTimeout(interceptAndReload, 200);
                    return result;
                };
            }
            
            // 劫持 selectCharacterById
            if (typeof selectCharacterById !== 'undefined') {
                const originalSelect = selectCharacterById;
                window.selectCharacterById = async function(...args) {
                    const result = await originalSelect.apply(this, args);
                    setTimeout(interceptAndReload, 200);
                    return result;
                };
            }
            
            // 劫持 setCharacterId
            if (typeof setCharacterId !== 'undefined') {
                const originalSetId = setCharacterId;
                window.setCharacterId = async function(...args) {
                    const result = await originalSetId.apply(this, args);
                    setTimeout(interceptAndReload, 200);
                    return result;
                };
            }
        }
        
                                setTimeout(() => {
            hookCharacterLoading();
        }, 1000);
        
                        // 定时轮询检查（备用方案）
        let lastCharId = null;
        setInterval(() => {
            try {
                const ctx = SillyTavern?.getContext?.();
                if (ctx && ctx.characterId !== lastCharId && ctx.characterId !== undefined) {
                    lastCharId = ctx.characterId;
                    setTimeout(interceptAndReload, 100);
                }
            } catch (e) {
                // 忽略错误
            }
        }, 1000);

                // ============ 导出拦截 ============

                // 🔧 优化：拦截fetch请求以处理导出 - 添加快速路径过滤
        const originalFetch = window.fetch;
        const EXPORT_KEYWORDS = ['/api/characters/export', '/exportcharacter', 'export'];
        
        window.fetch = async function(...args) {
            const [url, options] = args;
            
            // 🔧 快速过滤：URL 中没有导出关键词则直接放行
            if (typeof url !== 'string' || !EXPORT_KEYWORDS.some(k => url.includes(k))) {
                return originalFetch.apply(this, args);
            }
            
            // 检测JSON导出请求
            const isExportRequest = url.includes('/api/characters/export') ||
                (url.includes('/api/characters/') && url.includes('export')) ||
                url.includes('/exportcharacter');
            
                                                                                                if (isExportRequest && (!options?.method || options.method === 'POST' || options.method === 'GET')) {
                
                try {
                    const response = await originalFetch.apply(this, args);
                    const clonedResponse = response.clone();
                    
                const contentType = response.headers.get('content-type') || '';
                
                                // 处理 PNG 导出
                if (contentType.includes('image/png') || contentType.includes('image/')) {
                    
                    try {
                                                                                                                                                const blob = await clonedResponse.blob();
                        const encryptedBlob = await processPngBlobForExport(blob);
                        if (encryptedBlob) {
                            safeToast('success', 'PNG 已加密保护', 'Hakimi DRM');
                            return new Response(encryptedBlob, {
                                status: 200,
                                statusText: 'OK',
                                headers: new Headers({
                                    'Content-Type': 'image/png',
                                    'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment; filename="character.png"'
                                })
                            });
                        }

                        return response;
                    } catch (e) {
                        console.error('[Hakimi] PNG 加密错误:', e);
                        return response;
                    }
                    }
                    
                                                        // 处理 JSON 导出
                let jsonData;
                try {
                    jsonData = await clonedResponse.json();
                } catch (e) {
                    console.error("[Hakimi] JSON 解析失败:", e.message);
                    return response;
                }
                    
                                                                            // 智能检测是否需要加密
                let needsEncryption = true;
                    
                    // 检查旧格式
                    if ((jsonData.data?.creator_notes || jsonData.creator_notes || '').includes('HAKIMI_8LAYER::')) {
                        needsEncryption = false;
                    }
                    
                    // 检查新格式
                    const coreData = jsonData.data || jsonData;
                    const isLocked = coreData.name?.startsWith('LOCKED_');
                    const hasRealContent = coreData.description || coreData.personality || coreData.first_mes;
                    
                    if (isLocked && !hasRealContent) {

                        needsEncryption = false;
                    } else if (coreData.extensions?.hakimi_drm || jsonData.extensions?.hakimi_drm) {

                        // 清理残留
                        if (coreData.extensions?.hakimi_drm) delete coreData.extensions.hakimi_drm;
                        if (jsonData.extensions?.hakimi_drm) delete jsonData.extensions.hakimi_drm;
                        needsEncryption = true;
                    }
                    
                                        if (!needsEncryption) {
                        return response;
                    }
                    
                    // 提取需要加密的核心数据
                    const encryptedPayload = encodeEightLayers(coreData);
                    
                                                            if (encryptedPayload) {
                    const rawName = coreData.name || "Unknown";
                    const safeName = rawName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_]/g, '_');
                            
                                                // 移除保护层标记
                            let cleanedPayload = encryptedPayload;
                            if (cleanedPayload.includes('=== DATA START ===')) {
                                const lines = cleanedPayload.split('\n');
                                const startIdx = lines.findIndex(l => l.includes('=== DATA START ==='));
                                const endIdx = lines.findIndex(l => l.includes('=== DATA END ==='));
                                if (startIdx !== -1 && endIdx !== -1) {
                                    cleanedPayload = lines.slice(startIdx + 1, endIdx).join('\n');
                                }
                            }
                            
                    // 分块存储（每块8KB）
                            const CHUNK_SIZE = 8192;
                            const chunks = [];
                            for (let i = 0; i < cleanedPayload.length; i += CHUNK_SIZE) {
                                chunks.push(cleanedPayload.substring(i, i + CHUNK_SIZE));
                            }
                            
                                                        const encryptedCard = {
                                "spec": "chara_card_v2",
                                "spec_version": "2.0",
                                "data": {
                                    "name": "LOCKED_" + safeName,
                                    "description": "⚠️ 八层DRM保护内容\n需要安装哈基米插件才能查看",
                                    "personality": "",
                                    "scenario": "",
                                    "first_mes": "System: Encrypting...",
                                    "mes_example": "",
                                    "creator_notes": "Protected by Hakimi DRM v12.1 - 需要插件解密",
                                    "tags": ["HAKIMI_DRM_V3"],
                                    "creator": "Hakimi_8Layer_v12.1",
                                                                        "extensions": {
                                        "hakimi_drm": {
                                            "version": "v12.1",
                                            "chunks": chunks,
                                            "total_length": cleanedPayload.length,
                                            "checksum": cleanedPayload.length.toString(16),
                                            "timestamp": Date.now()
                                        }
                                    }
                                }
                                                        };
                            
                            safeToast('success', '导出已加密保护', 'Hakimi DRM');
                            return new Response(JSON.stringify(encryptedCard, null, 2), {
                                status: 200,
                                statusText: 'OK',
                                headers: new Headers({
                                    'Content-Type': 'application/json; charset=utf-8',
                                    'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment; filename="character.json"'
                                })
                            });
                        }
                    
                    return response;
                } catch (e) {
                    console.error("[Hakimi] 导出拦截失败:", e);
                    return originalFetch.apply(this, args);
                }
            }
            
            return originalFetch.apply(this, args);
        };

                // 🔧 优化：拦截PNG导出 - 使用事件委托到特定容器
        function interceptPngExport() {
            setTimeout(() => {
                const containers = [
                    document.querySelector('#character_popup'),
                    document.querySelector('#dialogue_popup'),
                    document.querySelector('.menu_buttons'),
                    document.body
                ];
                
                const container = containers.find(c => c !== null) || document.body;
                
                container.addEventListener('click', async function(e) {
                    const target = e.target.closest('[id*="export"], [class*="export"], .menu_button');
                    if (!target) return;
                    
                    const text = target.textContent?.toLowerCase() || '';
                    const id = target.id?.toLowerCase() || '';
                    
                    // PNG导出通过API拦截处理
                }, true);
                
                debugLog('PNG导出监听已绑定到:', container.id || container.className || 'body');
            }, 2000);
        }
        interceptPngExport();

        // 拦截PNG相关的API请求
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        const originalXhrSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._hakimiUrl = url;
            this._hakimiMethod = method;
            return originalXhrOpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            const url = this._hakimiUrl || '';
            
            // 拦截PNG导出请求 - 支持多种路径
            const isPngExport = url.includes('/api/characters/') && 
                (url.includes('png') || url.includes('export') || url.includes('download'));
            
                        if (isPngExport) {
                const originalOnload = this.onload;
                                this.onload = function(e) {
                    // PNG导出后处理
                    if (this.response && this.response instanceof Blob) {
                        // PNG的处理需要修改tEXt chunk中的数据
                        // 这里通过后续的blob处理来完成
                    }
                    if (originalOnload) originalOnload.call(this, e);
                };
            }
            
            return originalXhrSend.apply(this, [body]);
        };

                                // 拦截Blob创建以处理导出
        const originalCreateObjectURL = URL.createObjectURL;
        const pendingEncryptions = new Map(); // 存储待加密的 Blob
        const encryptedBlobs = new WeakMap(); // 存储已加密的 Blob
        
        URL.createObjectURL = function(blob) {
                                                // 处理 JSON 导出
            if (blob instanceof Blob && blob.type === 'application/json') {
                // 🔧 关键修复：同步读取并加密，不返回临时 URL
                // 使用 FileReaderSync 在主线程同步读取（仅在 Worker 中可用）
                // 所以我们需要改用 Promise + 立即执行
                
                // 创建一个 Promise 来同步化异步操作
                let encryptedBlob = null;
                const reader = new FileReader();
                
                                // 🔧 最终方案：立即读取并加密（使用同步 XMLHttpRequest）
                try {
                    const xhr = new XMLHttpRequest();
                    const tempUrl = originalCreateObjectURL.call(URL, blob);
                    xhr.open('GET', tempUrl, false); // false = 同步
                    xhr.send();
                    URL.revokeObjectURL(tempUrl);
                    
                    const jsonData = JSON.parse(xhr.responseText);
                    
                    // 智能检测是否需要加密
                    let needsEncryption = true;
                    
                    if ((jsonData.data?.creator_notes || jsonData.creator_notes || '').includes('HAKIMI_8LAYER::')) {
                        needsEncryption = false;
                    }
                    
                    const coreData = jsonData.data || jsonData;
                    const isLocked = coreData.name?.startsWith('LOCKED_');
                    const hasRealContent = coreData.description || coreData.personality || coreData.first_mes;
                    
                    if (isLocked && !hasRealContent) {
                        needsEncryption = false;
                    } else if (coreData.extensions?.hakimi_drm || jsonData.extensions?.hakimi_drm) {

                        if (coreData.extensions?.hakimi_drm) delete coreData.extensions.hakimi_drm;
                        if (jsonData.extensions?.hakimi_drm) delete jsonData.extensions.hakimi_drm;
                        needsEncryption = true;
                    }
                    
                                        if (!needsEncryption) {
                        return originalCreateObjectURL.call(URL, blob);
                    }
                    
                    const encryptedPayload = encodeEightLayers(coreData);
                    
                    if (!encryptedPayload) {
                        console.error('[Hakimi] 加密失败');
                        return originalCreateObjectURL.call(URL, blob);
                    }
                    
                    // 移除保护层标记
                    let cleanedPayload = encryptedPayload;
                    if (cleanedPayload.includes('=== DATA START ===')) {
                        const lines = cleanedPayload.split('\n');
                        const startIdx = lines.findIndex(l => l.includes('=== DATA START ==='));
                        const endIdx = lines.findIndex(l => l.includes('=== DATA END ==='));
                        if (startIdx !== -1 && endIdx !== -1) {
                            cleanedPayload = lines.slice(startIdx + 1, endIdx).join('\n');
                        }
                    }
                    
                    // 分块存储
                    const CHUNK_SIZE = 8192;
                    const chunks = [];
                    for (let i = 0; i < cleanedPayload.length; i += CHUNK_SIZE) {
                        chunks.push(cleanedPayload.substring(i, i + CHUNK_SIZE));
                    }
                    
                                        const rawName = coreData.name || 'Unknown';
// 保留中文字符
const safeName = rawName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_]/g, '_');
                    
                    const encryptedCard = {
                        "spec": "chara_card_v2",
                        "spec_version": "2.0",
                        "data": {
                            "name": "LOCKED_" + safeName,
                            "description": "⚠️ 八层DRM保护内容\n需要安装哈基米插件才能查看",
                            "personality": "",
                            "scenario": "",
                            "first_mes": "System: Encrypting...",
                            "mes_example": "",
                            "creator_notes": "Protected by Hakimi DRM v12.1",
                            "tags": ["HAKIMI_DRM_V3"],
                            "creator": "Hakimi_8Layer_v12.1",
                            "extensions": {
                                "hakimi_drm": {
                                    "version": "v12.1",
                                    "chunks": chunks,
                                    "total_length": cleanedPayload.length,
                                    "checksum": cleanedPayload.length.toString(16),
                                    "timestamp": Date.now()
                                }
                            },
                            "character_book": null
                        }
                    };
                    

                    const encryptedBlob = new Blob([JSON.stringify(encryptedCard, null, 2)], {type: 'application/json'});
                    return originalCreateObjectURL.call(URL, encryptedBlob);
                    
                } catch (e) {
                    console.error('[Hakimi] 同步加密失败:', e);
                    return originalCreateObjectURL.call(URL, blob);
                }
            }
            
                                                            // 🔧 修复：PNG 导出已在 fetch 拦截器中处理，这里跳过避免双重加密
            // PNG 导出暂时跳过 Blob 拦截器
            if (blob instanceof Blob && blob.type === 'image/png') {
                return originalCreateObjectURL.call(URL, blob);
            }
            
            // 其他类型的 Blob，直接返回
            return originalCreateObjectURL.call(URL, blob);
        };

                                // PNG 导出加密
        async function processPngBlobForExport(blob) {
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // 查找 PNG 的 tEXt chunk（包含 JSON 数据）
                                const textChunkStart = findPngTextChunk(uint8Array);
                if (textChunkStart === -1) {
                    return null;
                }
                
                // 提取 JSON 数据
                                const chunkData = extractTextChunkData(uint8Array, textChunkStart);
                if (!chunkData) {
                    return null;
                }
                
                                // 检查是否已加密
                if (chunkData.includes('HAKIMI_8LAYER::') || chunkData.includes('hakimi_drm')) {
                    return null;
                }
                
                // 🔧 修复：PNG 文本数据可能是 Base64 编码的
                let jsonData;
                try {
                    // 先尝试直接解析
                    jsonData = JSON.parse(chunkData);
                } catch (e1) {
                    // 如果失败，尝试 Base64 解码
                                                try {
        const decoded = atob(chunkData);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
        }
        const utf8String = new TextDecoder('utf-8').decode(bytes);
        jsonData = JSON.parse(utf8String);
                    } catch (e2) {
                        console.error("[Hakimi] PNG 文本数据无法解析:", e2.message);
                        return null;
                    }
                }
                
                const coreData = jsonData.data || jsonData;
                const encryptedPayload = encodeEightLayers(coreData);
                
                if (!encryptedPayload) {
                    console.error("[Hakimi] 加密失败");
                    return null;
                }
                
                // 移除保护层标记
                let cleanedPayload = encryptedPayload;
                if (cleanedPayload.includes('=== DATA START ===')) {
                    const lines = cleanedPayload.split('\n');
                    const startIdx = lines.findIndex(l => l.includes('=== DATA START ==='));
                    const endIdx = lines.findIndex(l => l.includes('=== DATA END ==='));
                    if (startIdx !== -1 && endIdx !== -1) {
                        cleanedPayload = lines.slice(startIdx + 1, endIdx).join('\n');
                    }
                }
                
                // 分块存储
                const CHUNK_SIZE = 8192;
                const chunks = [];
                for (let i = 0; i < cleanedPayload.length; i += CHUNK_SIZE) {
                    chunks.push(cleanedPayload.substring(i, i + CHUNK_SIZE));
                }
                
                                    const rawName = coreData.name || 'Unknown';
// 保留中文字符
const safeName = rawName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_]/g, '_');
                
                const encryptedCard = {
                    "spec": "chara_card_v2",
                    "spec_version": "2.0",
                    "data": {
                        "name": "LOCKED_" + safeName,
                        "description": "⚠️ 八层DRM保护内容\n需要安装哈基米插件才能查看",
                        "personality": "",
                        "scenario": "",
                        "first_mes": "System: Encrypting...",
                        "mes_example": "",
                        "creator_notes": "Protected by Hakimi DRM v12.1",
                        "tags": ["HAKIMI_DRM_V3"],
                        "creator": "Hakimi_8Layer_v12.1",
                        "extensions": {
                            "hakimi_drm": {
                                "version": "v12.1",
                                "chunks": chunks,
                                "total_length": cleanedPayload.length,
                                "checksum": cleanedPayload.length.toString(16),
                                "timestamp": Date.now()
                            }
                        },
                        "character_book": null
                    }
                };
                
                                                                // 重新构建 PNG，替换 tEXt chunk
                const encryptedJsonStr = JSON.stringify(encryptedCard);
                const base64Encoded = btoa(unescape(encodeURIComponent(encryptedJsonStr)));
                
                                const newPngData = rebuildPngWithEncryptedData(uint8Array, base64Encoded);
                if (!newPngData) {
                    console.error("[Hakimi] PNG 重建失败");
                    return null;
                }
                
                return new Blob([newPngData], { type: 'image/png' });
                
            } catch (e) {
                console.error("[Hakimi] PNG 处理错误:", e);
                return null;
            }
        }
        
        
        
                // 🔧 PNG 工具：重建 PNG 文件（增强验证）
        function rebuildPngWithEncryptedData(uint8Array, base64Data) {
            try {
                // 🔧 1. 验证 PNG 签名
                const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
                for (let i = 0; i < 8; i++) {
                    if (uint8Array[i] !== PNG_SIGNATURE[i]) {
                        console.error('[Hakimi] 无效的 PNG 签名');
                        return null;
                    }
                }
                
                const result = [];
                
                // 复制 PNG signature（前 8 字节）
                for (let i = 0; i < 8; i++) {
                    result.push(uint8Array[i]);
                }
                
                let pos = 8;
                let encryptedChunkAdded = false;
                
                // 遍历所有 chunks
                while (pos < uint8Array.length) {
                    // 🔧 2. 检查是否有足够的字节读取 chunk 头部
                    if (pos + 12 > uint8Array.length) {
                        console.error('[Hakimi] PNG 数据不完整，停止处理');
                        break;
                    }
                    
                    const length = (uint8Array[pos] << 24) | (uint8Array[pos + 1] << 16) | 
                                  (uint8Array[pos + 2] << 8) | uint8Array[pos + 3];
                    
                    // 🔧 3. 验证 chunk 长度是否合理
                    if (length < 0 || length > 0x7FFFFFFF) {
                        console.error('[Hakimi] Chunk 长度异常:', length);
                        break;
                    }
                    
                    // 🔧 4. 计算 chunk 总大小并验证
                    const chunkSize = 4 + 4 + length + 4;
                    if (pos + chunkSize > uint8Array.length) {
                        console.error('[Hakimi] Chunk 数据不完整');
                        break;
                    }
                    
                    const type = String.fromCharCode(
                        uint8Array[pos + 4], uint8Array[pos + 5], 
                        uint8Array[pos + 6], uint8Array[pos + 7]
                    );
                    
                    // 跳过所有 tEXt/iTXt chunk
                    if (type === 'tEXt' || type === 'iTXt') {
                        pos += chunkSize;
                        continue;
                    }
                    
                    if (type === 'IEND' && !encryptedChunkAdded) {
                        const newChunk = createPngTextChunk('chara', base64Data);
                        for (let i = 0; i < newChunk.length; i++) {
                            result.push(newChunk[i]);
                        }
                        encryptedChunkAdded = true;
                    }
                    
                    // 复制其他 chunk（IHDR, IDAT, IEND 等）
                    for (let i = 0; i < chunkSize; i++) {
                        result.push(uint8Array[pos + i]);
                    }
                    
                    pos += chunkSize;
                    
                    if (type === 'IEND') break;
                }
                
                // 🔧 5. 验证是否成功添加了加密数据
                if (!encryptedChunkAdded) {
                    console.error('[Hakimi] 未找到 IEND chunk，PNG 可能已损坏');
                    return null;
                }
                
                return new Uint8Array(result);
            } catch (e) {
                console.error('[Hakimi] PNG 重建失败:', e);
                return null;
            }
        }
        
        // 创建 PNG tEXt chunk
        function createPngTextChunk(keyword, text) {
            const keywordBytes = new TextEncoder().encode(keyword);
            const textBytes = new TextEncoder().encode(text);
            const dataLength = keywordBytes.length + 1 + textBytes.length;
            
            const chunk = [];
            
            // 长度（4字节）
            chunk.push((dataLength >> 24) & 0xFF);
            chunk.push((dataLength >> 16) & 0xFF);
            chunk.push((dataLength >> 8) & 0xFF);
            chunk.push(dataLength & 0xFF);
            
            // 类型 'tEXt'
            chunk.push(0x74, 0x45, 0x58, 0x74);
            
            // 数据：keyword + null + text
            for (let i = 0; i < keywordBytes.length; i++) {
                chunk.push(keywordBytes[i]);
            }
            chunk.push(0);
            for (let i = 0; i < textBytes.length; i++) {
                chunk.push(textBytes[i]);
            }
            
            // CRC32
            const crc = calculateCRC32(chunk.slice(4));
            chunk.push((crc >> 24) & 0xFF);
            chunk.push((crc >> 16) & 0xFF);
            chunk.push((crc >> 8) & 0xFF);
            chunk.push(crc & 0xFF);
            
            return new Uint8Array(chunk);
        }
        
        // 计算 CRC32
        function calculateCRC32(data) {
            const crcTable = [];
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) {
                    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
                }
                crcTable[n] = c;
            }
            
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < data.length; i++) {
                crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
        
        function findPngTextChunk(uint8Array) {
            // PNG签名后开始查找
            for (let i = 8; i < uint8Array.length - 8; i++) {
                // 查找 "tEXt" 或 "iTXt" chunk
                if ((uint8Array[i] === 0x74 && uint8Array[i+1] === 0x45 && 
                     uint8Array[i+2] === 0x58 && uint8Array[i+3] === 0x74) ||
                    (uint8Array[i] === 0x69 && uint8Array[i+1] === 0x54 && 
                     uint8Array[i+2] === 0x58 && uint8Array[i+3] === 0x74)) {
                    return i - 4; // 返回chunk长度字段位置
                }
            }
            return -1;
        }

        function extractTextChunkData(uint8Array, chunkStart) {
            try {
                // 读取chunk长度 (大端序)
                const length = (uint8Array[chunkStart] << 24) | 
                              (uint8Array[chunkStart + 1] << 16) | 
                              (uint8Array[chunkStart + 2] << 8) | 
                              uint8Array[chunkStart + 3];
                
                // chunk数据开始位置 (跳过长度4字节 + 类型4字节)
                const dataStart = chunkStart + 8;
                
                // 查找关键字结束的null字节
                let nullPos = dataStart;
                while (nullPos < dataStart + length && uint8Array[nullPos] !== 0) {
                    nullPos++;
                }
                
                // 提取数据部分
                const textData = uint8Array.slice(nullPos + 1, dataStart + length);
                return new TextDecoder().decode(textData);
            } catch (e) {
                return null;
            }
        }

        debugLog("导出加密拦截器已启用");
    });

})();


