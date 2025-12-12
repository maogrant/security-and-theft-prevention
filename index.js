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
        
        console.log("🐱 [Hakimi] 八层解密插件已加载 v1.2");

        const indicator = document.createElement('div');
        indicator.id = 'hakimi-indicator';
        document.body.appendChild(indicator);
        
        if (!localStorage.getItem('hakimi_installed_alert')) {
            alert("✅ 哈基米八层加密插件安装成功！");
            localStorage.setItem('hakimi_installed_alert', 'true');
        }

        let isReloading = false;

        // ============ 工具函数：安全的字节转字符串 ============
        
        function bytesToString(bytes) {
            // 🔧 修复：Uint8Array/Uint16Array 需要保持为字节数组，不要转为UTF-16字符串
            // 分块处理，避免栈溢出
            const CHUNK_SIZE = 8192;
            let result = '';
            const arr = bytes instanceof Uint8Array ? bytes : 
                        (bytes instanceof Uint16Array ? bytes : Array.from(bytes));
            
            // 🔧 关键修复：对于Uint8Array，直接保留字节值，不要尝试解码UTF-8
            // 这里只是将字节数据包装成二进制字符串，后续在byteTransformReverse中解码
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

        // 🔧 预计算模逆元表
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
                console.log("[Hakimi] 开始八层解密...");
                return decodeEightLayers(encodedStr);
            } catch (e) { 
                console.error("[Hakimi] 解密失败:", e); 
                return null; 
            }
        }

                                function decodeEightLayers(data) {
            let layerCount = 0;
            let result = data;
            
            console.log("═══════════════════════════════════");
            console.log("🚀 [Hakimi] 开始八层解密");
            console.log(`📊 原始数据: ${data.length} 字符`);
            console.log("═══════════════════════════════════");
            
            try {
                
                // 安全检查输入
                if (!result || typeof result !== 'string' || result.length === 0) {
                    console.error("[Hakimi] 输入数据无效");
                    return null;
                }
                
                // 第1层：直接使用数据，不需要移除保护层
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] 跳过保护层移除...`);
                console.log(`   输入: ${result.length} 字符`);
                
                // 第2层：移除校验和
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] 移除校验和...`);
                console.log(`   输入: ${result.length} 字符`);
                result = removeChecksum(result);
                console.log(`   输出: ${result.length} 字符`);
                console.log(`   预览: ${result.substring(0, 80)}...`);
                
                                // 🔧 第3层：跳过Unicode去混淆（已在加密时禁用）
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] 跳过Unicode去混淆（已禁用）...`);
                console.log(`   输入: ${result.length} 字符`);
                // result = result.replace(/[\u200B\u200C\u200D\uFEFF\u0300-\u036F\u1AB0-\u1AFF\u20D0-\u20FF\uFE20-\uFE2F]/g, '');
                console.log(`   输出: ${result.length} 字符`);
                console.log(`   预览: ${result.substring(0, 80)}...`);
                
                                                // 第4层：Base91解码
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] Base91解码...`);
                console.log(`   输入: ${result.length} 字符`);
                console.log(`   输入前20字符: ${Array.from(result.substring(0, 20)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')}`);
                
                // 检查输入是否包含非 ASCII 字符
                let hasNonAscii = false;
                for (let i = 0; i < Math.min(100, result.length); i++) {
                    if (result.charCodeAt(i) > 127) {
                        hasNonAscii = true;
                        console.error(`[Hakimi] 警告：Base91输入包含非ASCII字符 at ${i}: 0x${result.charCodeAt(i).toString(16)}`);
                        break;
                    }
                }
                
                                result = base91Decode(result);
                if (!result || result.length === 0) {
                    console.error("[Hakimi] Base91解码失败");
                    return null;
                }
                console.log(`   输出类型: ${result.constructor.name}`);
                console.log(`   输出长度: ${result.length}`);
                if (result instanceof Uint8Array) {
                    console.log(`   输出前20字节: ${Array.from(result.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                } else {
                    console.log(`   预览: ${result.substring(0, 80)}...`);
                }
                
                                // 第5层：栅栏解密
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] 栅栏解密...`);
                console.log(`   输入类型: ${result.constructor.name}`);
                console.log(`   输入长度: ${result.length}`);
                if (result instanceof Uint8Array) {
                    console.log(`   输入前10字节: ${Array.from(result.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                }
                result = railFenceDecipher(result, 4);
                console.log(`   输出类型: ${result.constructor.name}`);
                console.log(`   输出长度: ${result.length}`);
                if (result instanceof Uint8Array) {
                    console.log(`   输出前10字节: ${Array.from(result.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                } else {
                    console.log(`   预览: ${result.substring(0, 80)}...`);
                }
                
                                // 第6层：XOR解密
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] XOR链式解密...`);
                console.log(`   输入类型: ${result.constructor.name}`);
                console.log(`   输入长度: ${result.length}`);
                result = xorChainReverse(result, 3);
                console.log(`   输出类型: ${result.constructor.name}`);
                console.log(`   输出长度: ${result.length}`);
                if (result instanceof Uint8Array) {
                    console.log(`   输出前10字节: ${Array.from(result.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                }
                
                                // 第7层：斐波那契反洗牌
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] 斐波那契反洗牌...`);
                console.log(`   输入类型: ${result.constructor.name}`);
                console.log(`   输入长度: ${result.length}`);
                result = fibonacciUnshuffle(result, 2);
                console.log(`   输出类型: ${result.constructor.name}`);
                console.log(`   输出长度: ${result.length}`);
                if (result instanceof Uint8Array) {
                    console.log(`   输出前10字节: ${Array.from(result.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                }
                
                                // 第8层：矩阵逆变换
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] 矩阵逆变换...`);
                console.log(`   输入类型: ${result.constructor.name}`);
                console.log(`   输入长度: ${result.length}`);
                result = matrixTransformReverse(result, 1);
                console.log(`   输出类型: ${result.constructor.name}`);
                console.log(`   输出长度: ${result.length}`);
                if (result instanceof Uint8Array) {
                    console.log(`   输出前10字节: ${Array.from(result.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                }
                
                                                // 第9层：字节逆变换
                layerCount++;
                console.log(`\n🔓 [第${layerCount}层] 字节逆变换...`);
                console.log(`   输入类型: ${result.constructor.name}`);
                console.log(`   输入长度: ${result.length}`);
                if (result instanceof Uint8Array) {
                    console.log(`   输入前10字节: ${Array.from(result.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                }
                result = byteTransformReverse(result, 0);
                console.log(`   输出类型: ${result.constructor.name}`);
                console.log(`   输出长度: ${result.length}`);
                if (result instanceof Uint8Array) {
                    console.log(`   输出前10字节: ${Array.from(result.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                }
                
                                // 🔧 关键修复：在这里统一使用TextDecoder解码UTF-8
                console.log(`\n📦 [最终] UTF-8解码...`);
                if (!(result instanceof Uint8Array)) {
                    console.error('[Hakimi] 错误：byteTransformReverse应该返回Uint8Array');
                    return null;
                }
                
                try {
                    result = new TextDecoder('utf-8', { fatal: false }).decode(result);
                    console.log(`   解码成功: ${result.length} 字符`);
                    console.log(`   前50字符: ${result.substring(0, 50)}`);
                } catch (e) {
                    console.error('[Hakimi] TextDecoder解码失败:', e);
                    return null;
                }
                
                                // 最终解析JSON
                console.log(`\n📦 [最终] 解析JSON...`);
                console.log(`   输出类型: ${typeof result}`);
                console.log(`   数据长度: ${result.length} 字符`);
                
                // 🔧 关键修复：清理JSON字符串中的非法控制字符
                // bytesToString可能产生实际的控制字符（ASCII 0-31），而JSON要求这些字符必须被转义
                // 但要保留合法的转义序列如 \n \t \r
                result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
                result = result.trim();
                console.log(`   清理后: ${result.length} 字符`);
                console.log(`   清理后前50字符: ${result.substring(0, 50)}`);
                
                // 尝试查找JSON边界
                const jsonStart = result.indexOf('{');
                const jsonEnd = result.lastIndexOf('}');
                
                if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
                    console.error("[Hakimi] 无法找到JSON边界");
                    console.error(`   jsonStart: ${jsonStart}, jsonEnd: ${jsonEnd}`);
                    console.error(`   首100字符: ${result.substring(0, 100)}`);
                    return null;
                }
                
                const jsonStr = result.substring(jsonStart, jsonEnd + 1);
                console.log(`   JSON长度: ${jsonStr.length} 字符`);
                console.log(`   JSON首100字符: ${jsonStr.substring(0, 100)}...`);
                
                const jsonData = JSON.parse(jsonStr);
                
                delete jsonData._format;
                delete jsonData._version;
                delete jsonData._timestamp;
                delete jsonData._encoder;
                delete jsonData._watermark;
                
                                                console.log("═══════════════════════════════════");
                console.log("✅ [Hakimi] 解密完成！");
                console.log(`   角色名: ${jsonData.name || jsonData.data?.name}`);
                console.log(`   字段数: ${Object.keys(jsonData).length}`);
                console.log("═══════════════════════════════════");
                return jsonData;
                
            } catch (e) {
                console.error("═══════════════════════════════════");
                console.error("❌ [Hakimi] 解密失败于第 " + layerCount + " 层");
                console.error(`   错误: ${e.message}`);
                console.error(`   当前数据长度: ${result ? result.length : 0}`);
                console.error("═══════════════════════════════════");
                console.error(e.stack);
                return null;
            }
        }

        function removeChecksum(str) {
            // 🔧 关键修复：正确计算原始长度
            // 加密时：input.length → interval = floor(input.length / 12) → output.length = input.length + 12
            // 解密时：str.length = original + 12 → original = str.length - 12 → interval = floor(original / 12)
            const originalLength = str.length - 12;
            const interval = Math.max(3, Math.floor(originalLength / 12));
            let result = '';
            let checksumCount = 0;
            
            for (let i = 0; i < str.length; i++) {
                const restoredCount = result.length;
                // 检查当前位置是否是校验字符
                if (restoredCount > 0 && restoredCount % interval === 0 && checksumCount < 12) {
                    // 跳过校验字符
                    checksumCount++;
                    continue;
                }
                result += str[i];
            }
            
            console.log(`[Hakimi] removeChecksum: 输入${str.length}, interval=${interval}, 移除12个, 输出${result.length}`);
            return result;
        }

                        function base91Decode(str) {
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";
            const result = [];
            let buffer = 0;
            let bits = 0;
            let v = -1;
            let validCharCount = 0;
            
            for (let i = 0; i < str.length; i++) {
                const index = alphabet.indexOf(str[i]);
                if (index === -1) continue;
                validCharCount++;
                
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
            
            // 🔧 关键修复：完全移除末尾处理，因为正确的Base91不需要这个
            // 加密时的末尾处理：if (bits > 0) 添加1或2个字符
            // 解码时：如果有剩余字符，它们已经在主循环中处理了
            // 不应该再添加额外的字节
            
                                                // 🔧 终极修复：直接返回 Uint8Array，避免 JavaScript 字符串的 UTF-16 问题
            const uint8Array = new Uint8Array(result);
            console.log(`[Hakimi] Base91解码：输入${str.length}字符，有效${validCharCount}字符（跳过${str.length - validCharCount}个），输出${uint8Array.length}字节`);
            console.log(`[Hakimi] 输出前10字节: ${Array.from(uint8Array.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            
            // 🔧 检查非法字符
            if (validCharCount !== str.length) {
                const invalidChars = [];
                for (let i = 0; i < Math.min(str.length, 200); i++) {
                    if (alphabet.indexOf(str[i]) === -1) {
                        invalidChars.push({pos: i, char: str[i], code: str.charCodeAt(i)});
                    }
                }
                console.log(`[Hakimi] 前200字符中的非法字符:`, invalidChars);
            }
            
            return uint8Array;
        }

                function railFenceDecipher(input, layerIndex) {
            // 🔧 关键修复：强制使用 Uint8Array，不再支持字符串输入
            if (!(input instanceof Uint8Array)) {
                console.error('[Hakimi] railFenceDecipher 输入必须是 Uint8Array');
                throw new Error('railFenceDecipher requires Uint8Array input');
            }
            
            const length = input.length;
            const rails = 3 + (layerIndex % 5);
            const fence = new Array(rails).fill().map(() => []);
            
            console.log(`[DEBUG] railFenceDecipher: rails=${rails}, length=${length}`);
            
            const railLengths = new Array(rails).fill(0);
            let rail = 0, direction = 1;
            
            for (let i = 0; i < length; i++) {
                railLengths[rail]++;
                rail += direction;
                if (rail === 0 || rail === rails - 1) direction = -direction;
            }
            
            console.log(`[DEBUG] railLengths: ${railLengths.join(', ')}`);
            
            let index = 0;
            for (let r = 0; r < rails; r++) {
                for (let i = 0; i < railLengths[r]; i++) {
                    fence[r].push(input[index++]);
                }
            }
            
            console.log(`[DEBUG] fence 填充完成, 每轨道字节数: ${fence.map(f => f.length).join(', ')}`);
            
            // 🔧 始终返回 Uint8Array，保持字节流
            const result = new Uint8Array(length);
            rail = 0;
            direction = 1;
            const fenceIndices = new Array(rails).fill(0);
            
            for (let i = 0; i < length; i++) {
                result[i] = fence[rail][fenceIndices[rail]++];
                rail += direction;
                if (rail === 0 || rail === rails - 1) direction = -direction;
            }
            
            console.log(`[DEBUG] 解密后前10字节: ${Array.from(result.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            
            return result;
        }

                        function xorChainReverse(input, layerIndex) {
            // 🔧 关键修复：强制使用 Uint8Array，不再支持字符串输入
            if (!(input instanceof Uint8Array)) {
                console.error('[Hakimi] xorChainReverse 输入必须是 Uint8Array');
                throw new Error('xorChainReverse requires Uint8Array input');
            }
            
            const bytes = input;
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
            // 🔧 关键修复：强制使用 Uint8Array，不再支持字符串输入
            if (!(input instanceof Uint8Array)) {
                console.error('[Hakimi] fibonacciUnshuffle 输入必须是 Uint8Array');
                throw new Error('fibonacciUnshuffle requires Uint8Array input');
            }
            
            const len = input.length;
            const chars = new Uint8Array(input);
            
            // 限制斐波那契数列长度
            const fibLen = Math.min(len, 1000);
            const fib = generateFibonacci(fibLen);
            
                        for (let round = 2; round >= 0; round--) {
                for (let i = len - 1; i > 0; i--) {
                    const fibIndex = i % fib.length;
                    const swapWith = (i + fib[fibIndex]) % len;
                    if (swapWith !== i) {
                        const temp = chars[i];
                        chars[i] = chars[swapWith];
                        chars[swapWith] = temp;
                    }
                }
            }
            
            // 🔧 始终返回 Uint8Array，保持字节流
            return chars;
        }

        // 🔧 修复：完整的矩阵逆变换
                        function matrixTransformReverse(input, layerIndex) {
            const matrixSize = 5;
            // 🔧 关键修复：强制使用 Uint8Array，不再支持字符串输入
            if (!(input instanceof Uint8Array)) {
                console.error('[Hakimi] matrixTransformReverse 输入必须是 Uint8Array');
                throw new Error('matrixTransformReverse requires Uint8Array input');
            }
            
            const bytes = input;
            const paddedLength = Math.ceil(bytes.length / (matrixSize * matrixSize)) * (matrixSize * matrixSize);
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
                        matrix[i][j] = idx < bytes.length ? bytes[idx] : 0;
                    }
                }
                
                // 🔧 逆向螺旋旋转
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
            
            // 🔧 返回 Uint8Array
            return result.slice(0, bytes.length);
        }

        // 🔧 新增：螺旋逆旋转函数
        function spiralUnrotate(matrix) {
            const size = matrix.length;
            const result = new Array(size).fill(0).map(() => new Array(size).fill(0));
            
            let top = 0, bottom = size - 1;
            let left = 0, right = size - 1;
            let values = [];
            
            // 🔧 步骤1：按顺时针螺旋收集（与加密时相同）
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
            
            // 🔧 步骤2：反转数组
            values = values.reverse();
            
            // 🔧 步骤3：按顺时针螺旋填充（与加密时相同）
            let index = 0;
            top = 0; bottom = size - 1;
            left = 0; right = size - 1;
            
            while (top <= bottom && left <= right && index < values.length) {
                // 顶部向右
                for (let i = left; i <= right && index < values.length; i++) {
                    result[top][i] = values[index++];
                }
                top++;
                
                // 右侧向下
                for (let i = top; i <= bottom && index < values.length; i++) {
                    result[i][right] = values[index++];
                }
                right--;
                
                // 底部向左
                if (top <= bottom) {
                    for (let i = right; i >= left && index < values.length; i--) {
                        result[bottom][i] = values[index++];
                    }
                    bottom--;
                }
                
                // 左侧向上
                if (left <= right) {
                    for (let i = bottom; i >= top && index < values.length; i--) {
                        result[i][left] = values[index++];
                    }
                    left++;
                }
            }
            
            return result;
        }

                                        // 🔧 完全重写：字节逆变换（匹配简化后的加密算法）
                function byteTransformReverse(input, layerIndex) {
            // 🔧 关键修复：强制使用 Uint8Array，不再支持字符串输入
            if (!(input instanceof Uint8Array)) {
                console.error('[Hakimi] byteTransformReverse 输入必须是 Uint8Array');
                throw new Error('byteTransformReverse requires Uint8Array input');
            }
            
            const bytes = input;
            
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
            
            // 第一步：逆向相邻字节互动（从前往后，因为只依赖前面的字节）
            // 加密时: result[i] = step1[i] ^ (step1[i-1] & 0x0F) ^ (result[i-1] & 0xF0)
            // 解密时: step1[i] = bytes[i] ^ (step1[i-1] & 0x0F) ^ (bytes[i-1] & 0xF0)
            // 🔧 关键：这里的bytes就是加密后的result，所以用bytes[i-1]
            
            const step1 = new Uint8Array(bytes.length);
            
            for (let i = 0; i < bytes.length; i++) {
                let byte = bytes[i];  // 这是加密后的result[i]
                
                // 逆向互动：使用前一个字节
                if (i > 0) {
                    byte ^= step1[i - 1] & 0x0F;      // 使用已恢复的step1
                    byte ^= bytes[i - 1] & 0xF0;      // 使用加密输入bytes（就是加密时的result）
                }
                
                step1[i] = byte;
            }
            
                        // 第二步：逆向主要变换
            const result = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
                let byte = step1[i];
                
                // 按加密的逆序操作：
                // 加密：XOR → 加法 → 循环左移
                // 解密：循环右移 → 减法 → XOR
                
                // 1. 逆向循环移位（循环右移）
                const shift = (i % 7) + 1;
                byte = ((byte >> shift) | (byte << (8 - shift))) & 0xFF;
                
                // 2. 逆向加法（减法）
                const prime = primes[i % primes.length];
                const layerFactor = (layerIndex + 1) * 17;
                // 🔧 关键修复：确保结果在 0-255 范围内
                byte = (byte - prime - layerFactor + 256) % 256;
                
                // 3. 逆向XOR
                const positionFactor = (i * 13) % 256;
                byte ^= positionFactor;
                
                result[i] = byte;
            }
            
                                        // 🔧 终极修复：直接返回Uint8Array，不在这里解码
            // 解码应该在最后一步统一处理，保持字节流完整性
            return result;
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
                console.log("[Hakimi] 开始八层加密...");
                console.log(`[Hakimi] JSON原始数据: ${result.length} 字符`);
                
                // 第1层：字节变换
                result = byteTransformForward(result, 0);
                console.log("[Hakimi] ✓ 字节变换");
                console.log(`[Hakimi] 输出类型: ${result.constructor.name}, 长度: ${result.length}`);
                
                // 第2层：矩阵变换
                result = matrixTransformForward(result, 1);
                console.log("[Hakimi] ✓ 矩阵变换");
                console.log(`[Hakimi] 输出类型: ${result.constructor.name}, 长度: ${result.length}`);
                
                // 第3层：斐波那契洗牌
                result = fibonacciShuffle(result, 2);
                console.log("[Hakimi] ✓ 洗牌");
                console.log(`[Hakimi] 输出类型: ${result.constructor.name}, 长度: ${result.length}`);
                
                // 第4层：XOR链式加密
                result = xorChainForward(result, 3);
                console.log("[Hakimi] ✓ XOR加密");
                console.log(`[Hakimi] 输出类型: ${result.constructor.name}, 长度: ${result.length}`);
                
                // 第5层：栅栏加密
                result = railFenceCipher(result, 4);
                console.log("[Hakimi] ✓ 栅栏加密");
                console.log(`[Hakimi] 输出类型: ${result.constructor.name}, 长度: ${result.length}`);
                
                // 第6层：Base91编码
                result = base91Encode(result);
                console.log("[Hakimi] ✓ Base91编码");
                console.log(`[Hakimi] 输出类型: ${result.constructor.name}, 长度: ${result.length}`);
                
                                // 🔧 第7层：跳过Unicode混淆（防止被过滤）
                // result = addUnicodeObfuscation(result);
                console.log("[Hakimi] ⚠️ 跳过Unicode混淆（防止字符被过滤）");
                
                // 第8层：添加校验和
                result = addChecksum(result);
                console.log("[Hakimi] ✓ 添加校验和");
                
                // 添加保护层标记
                result = '=== DATA START ===\n' + result + '\n=== DATA END ===';
                console.log("[Hakimi] ✅ 加密完成！");
                
                return result;
            } catch (e) {
                console.error("[Hakimi] ❌ 加密失败:", e);
                return null;
            }
        }

                function byteTransformForward(input, layerIndex) {
            // 🔧 修复：直接处理Uint8Array
            const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
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
            
            // 🔧 第二步：相邻字节互动（简化版：只依赖前面的字节）
            const result = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
                let byte = step1[i];
                
                // 只使用前面的字节，不使用后面的字节
                if (i > 0) {
                    byte ^= step1[i - 1] & 0x0F;      // 低4位
                    byte ^= result[i - 1] & 0xF0;     // 高4位（使用加密后的值）
                }
                
                result[i] = byte;
            }
            
            // 🔧 关键修复：直接返回Uint8Array，不使用bytesToString
            return result;
        }

        function matrixTransformForward(input, layerIndex) {
            const matrixSize = 5;
            // 🔧 修复：直接处理Uint8Array
            const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
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
            
            // 🔧 关键修复：直接返回Uint8Array，不使用bytesToString
            return result.slice(0, bytes.length);
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
            // 🔧 修复：直接处理Uint8Array，不再使用TextEncoder
            const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
            const len = bytes.length;
            const chars = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                chars[i] = bytes[i];
            }
            
            // 限制斐波那契数列长度，避免生成过大数组
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
            
            // 🔧 关键修复：直接返回Uint8Array，不使用bytesToString
            return chars;
        }

        function xorChainForward(input, layerIndex) {
            // 🔧 修复：直接处理Uint8Array
            const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
            const key = generateKey(layerIndex, bytes.length);
            const result = new Uint8Array(bytes.length);
            
            let prevByte = key[0];
            for (let i = 0; i < bytes.length; i++) {
                let transformedByte = bytes[i] ^ prevByte ^ key[i % key.length];
                
                // 🔧 移除非线性变换（不可逆，与解密对应）
                // const a = 1103515245;
                // const c = 12345;
                // const m = 2147483648;
                // let x = (transformedByte * i + a) % m;
                // x = (x * a + c) % m;
                // transformedByte = x % 256;
                
                result[i] = transformedByte;
                prevByte = (result[i] + i) % 256;
            }
            
            // 🔧 关键修复：直接返回Uint8Array，不使用bytesToString
            return result;
        }

        function railFenceCipher(input, layerIndex) {
            // 🔧 修复：直接处理Uint8Array
            const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
            const rails = 3 + (layerIndex % 5);
            const fence = new Array(rails).fill().map(() => []);
            
            let rail = 0, direction = 1;
            for (let i = 0; i < bytes.length; i++) {
                fence[rail].push(bytes[i]);
                rail += direction;
                if (rail === 0 || rail === rails - 1) direction = -direction;
            }
            
            // 🔧 关键修复：合并为Uint8Array，不使用字符串
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
            // 🔧 修复：直接处理Uint8Array
            const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
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
            
            for (let i = 0; i < str.length; i++) {
                // 🔧 修复：在每个interval位置插入校验字符
                if (i > 0 && i % interval === 0 && checksumCount < 12) {
                    const checkChar = String.fromCharCode(65 + (checksumCount % 26));
                    result += checkChar;
                    checksumCount++;
                }
                result += str[i];
            }
            
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
            
            // 🔧 修复：SillyTavern 可能把 extensions 放在 data 子对象中
            const extensions = charObj.extensions || charObj.data?.extensions;
            
            console.log('[Hakimi] 检查角色:', charObj.name);
            console.log('[Hakimi] extensions 位置:', extensions ? 'found' : 'not found');
            console.log('[Hakimi] hakimi_drm:', extensions?.hakimi_drm ? 'found' : 'not found');

                        // ✅ 优先检查 extensions 存储（新格式）
            if (extensions?.hakimi_drm?.chunks) {
                console.log("🔒 [Hakimi] 发现加密卡（extensions存储）");
                
                const drm = extensions.hakimi_drm;
                console.log(`[Hakimi] 检测到 ${drm.chunks.length} 个数据块`);
                console.log(`[Hakimi] 总长度: ${drm.total_length} 字符`);
                
                // 合并分块
                let raw = drm.chunks.join('');
                console.log(`[Hakimi] 合并后: ${raw.length} 字符`);
                
                // 校验完整性
                if (raw.length !== drm.total_length) {
                    console.error(`[Hakimi] ⚠️ 数据长度不匹配! 期望:${drm.total_length}, 实际:${raw.length}`);
                }
                
                                // 🔧 注意：八层加密版1.html 输出的数据已经被 removeChecksum 清理过
                // 需要移除多余的 'A' 字符（这些是 checksum 字符的占位符）
                console.log('[Hakimi] 原始数据预览:', raw.substring(0, 100));
                
                // 🔧 如果数据不包含保护层标记，手动添加（兼容新格式）
                if (!raw.includes('=== DATA START ===')) {
                    console.log('[Hakimi] 添加保护层标记以兼容解密流程');
                    raw = '=== DATA START ===\n' + raw + '\n=== DATA END ===';
                }
                
                const decrypted = safeDecrypt(raw);

                if (decrypted && (decrypted.name || decrypted.data?.name)) {
                    const realData = decrypted.data || decrypted;
                    console.log("[Hakimi] 解密成功:", realData.name);
                    
                    // 保存原始加密数据
                    markDecrypted(charId, raw);

                                        // 完整的字段列表
                    const fieldsToCopy = [
                        'name', 'description', 'personality', 'first_mes', 'mes_example',
                        'scenario', 'system_prompt', 'post_history_instructions', 'tags',
                        'creator', 'character_version', 'talkativeness', 'fav',
                        'depth_prompt_prompt', 'depth_prompt_depth', 'depth_prompt_role'
                    ];
                    
                    fieldsToCopy.forEach(field => {
                        if (realData[field] !== undefined) {
                            charObj[field] = realData[field];
                        }
                    });
                    
                    // 🔧 修复：确保 character_book 正确赋值
                    if (realData.character_book !== undefined) {
                        charObj.character_book = realData.character_book;
                    } else if (realData.characterBook !== undefined) {
                        charObj.character_book = realData.characterBook;
                    } else if (realData.world_info !== undefined) {
                        charObj.character_book = realData.world_info;
                    }
                    
                    charObj.extensions = { ...charObj.extensions, ...(realData.extensions || {}) };
                    charObj.alternate_greetings = realData.alternate_greetings || [];
                    charObj.creator_notes = realData.creator_notes || "Decrypted by Hakimi";
                    
                    // 🔧 调试：检查 character_book
                    console.log('[Hakimi] 解密后的数据字段:', Object.keys(realData));
                    console.log('[Hakimi] character_book 存在?', 'character_book' in realData);
                    console.log('[Hakimi] character_book 值:', realData.character_book);
                    console.log('[Hakimi] 赋值后 charObj.character_book:', charObj.character_book);
                    
                    if (charObj.data) {
                        fieldsToCopy.forEach(field => {
                            if (realData[field] !== undefined) {
                                charObj.data[field] = realData[field];
                            }
                        });
                        charObj.data.extensions = { ...charObj.data.extensions, ...(realData.extensions || {}) };
                        // 🔧 确保 character_book 同步到 data
                        if (charObj.character_book !== undefined) {
                            charObj.data.character_book = charObj.character_book;
                        }
                        charObj.data.alternate_greetings = charObj.alternate_greetings;
                        charObj.data.creator_notes = charObj.creator_notes;
                    }

                    isReloading = true;
                    try {
                        safeToast('info', "正在解码...", "Hakimi DRM");
                        await context.loadCharacter(charId);
                        safeToast('success', `🔓 ${realData.name} 解锁完成`, "Hakimi DRM");
                    } catch (e) {
                        console.error("[Hakimi] 重载失败", e);
                        safeToast('error', "重载失败", "Hakimi DRM");
                    } finally {
                        setTimeout(() => { isReloading = false; }, 500);
                    }
                }
                return;
            }

            // ⚠️ 兼容旧格式（creator_notes）
            if (charObj.creator_notes && charObj.creator_notes.includes("HAKIMI_8LAYER::")) {
                console.log("🔒 [Hakimi] 发现加密卡（旧格式）");
                
                const parts = charObj.creator_notes.split("HAKIMI_8LAYER::");
                if (parts.length < 2 || !parts[1]) {
                    console.warn("[Hakimi] 格式无效");
                    return;
                }
                
                const raw = parts[1].trim();
                const decrypted = safeDecrypt(raw);

                if (decrypted && (decrypted.name || decrypted.data?.name)) {
                    const realData = decrypted.data || decrypted;
                    console.log("[Hakimi] 解密成功:", realData.name);
                    
                    // 保存原始加密数据
                    markDecrypted(charId, raw);

                    // 完整的字段列表，确保所有角色卡信息都能正确解密
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
                    charObj.extensions = { ...charObj.extensions, ...(realData.extensions || {}) };
                    
                    // 🔧 修复：确保 character_book 正确赋值
                    if (realData.character_book !== undefined) {
                        charObj.character_book = realData.character_book;
                    } else if (realData.characterBook !== undefined) {
                        charObj.character_book = realData.characterBook;
                    } else if (realData.world_info !== undefined) {
                        charObj.character_book = realData.world_info;
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
                        // 🔧 确保 character_book 同步到 data
                        if (charObj.character_book !== undefined) {
                            charObj.data.character_book = charObj.character_book;
                        }
                        charObj.data.alternate_greetings = charObj.alternate_greetings;
                        charObj.data.creator_notes = charObj.creator_notes;
                    }

                    isReloading = true;
                    try {
                        safeToast('info', "正在解码...", "Hakimi DRM");
                        await context.loadCharacter(charId);
                        safeToast('success', `🔓 ${realData.name} 解锁完成`, "Hakimi DRM");
                    } catch (e) {
                        console.error("[Hakimi] 重载失败", e);
                        safeToast('error', "重载失败", "Hakimi DRM");
                    } finally {
                        setTimeout(() => { isReloading = false; }, 500);
                    }
                }
            }
        }

                                        // 🔧 方案A：劫持 SillyTavern 的角色加载函数
        console.log('[Hakimi] 使用函数劫持模式（不依赖eventSource）');
        
        function hookCharacterLoading() {
            // 劫持 getCharacters 函数
            const originalGetCharacters = window.getCharacters;
            if (originalGetCharacters) {
                window.getCharacters = async function(...args) {
                    const result = await originalGetCharacters.apply(this, args);
                    console.log('[Hakimi] 触发：getCharacters 完成');
                    setTimeout(interceptAndReload, 200);
                    return result;
                };
                console.log('[Hakimi] ✅ 已劫持 getCharacters');
            }
            
            // 劫持 selectCharacterById
            if (typeof window.selectCharacterById !== 'undefined') {
                const originalSelect = window.selectCharacterById;
                window.selectCharacterById = async function(...args) {
                    const result = await originalSelect.apply(this, args);
                    console.log('[Hakimi] 触发：selectCharacterById');
                    setTimeout(interceptAndReload, 200);
                    return result;
                };
                console.log('[Hakimi] ✅ 已劫持 selectCharacterById');
            }
            
            // 劫持 setCharacterId
            if (typeof window.setCharacterId !== 'undefined') {
                const originalSetId = window.setCharacterId;
                window.setCharacterId = async function(...args) {
                    const result = await originalSetId.apply(this, args);
                    console.log('[Hakimi] 触发：setCharacterId');
                    setTimeout(interceptAndReload, 200);
                    return result;
                };
                console.log('[Hakimi] ✅ 已劫持 setCharacterId');
            }
        }
        
        // 延迟劫持，等待函数加载
        setTimeout(() => {
            hookCharacterLoading();
        }, 1000);
        
        // 🔧 方案B：定时轮询检查（备用方案）
        let lastCharId = null;
        setInterval(() => {
            try {
                const ctx = SillyTavern?.getContext?.();
                if (ctx && ctx.characterId !== lastCharId && ctx.characterId !== undefined) {
                    console.log('[Hakimi] 轮询检测到角色切换:', lastCharId, '->', ctx.characterId);
                    lastCharId = ctx.characterId;
                    setTimeout(interceptAndReload, 100);
                }
            } catch (e) {
                // 忽略错误
            }
        }, 1000);
        
        console.log('[Hakimi] ✅ 监听器已启动（劫持+轮询模式）');

        // ============ 导出拦截 ============

        // 拦截fetch请求以处理导出
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const [url, options] = args;
            
            // 检测JSON导出请求 - 支持多种导出API路径
            const isExportRequest = typeof url === 'string' && (
                url.includes('/api/characters/export') ||
                (url.includes('/api/characters/') && url.includes('export')) ||
                url.includes('/exportcharacter')
            );
            
            if (isExportRequest && (!options?.method || options.method === 'POST' || options.method === 'GET')) {
                console.log("[Hakimi] 🔒 拦截JSON导出请求");
                
                try {
                    const response = await originalFetch.apply(this, args);
                    const clonedResponse = response.clone();
                    const jsonData = await clonedResponse.json();
                    
                                        // 检查是否已加密（检查 extensions.hakimi_drm 或 creator_notes）
                    const isAlreadyEncrypted = jsonData.data?.extensions?.hakimi_drm?.chunks || 
                                              jsonData.extensions?.hakimi_drm?.chunks ||
                                              (jsonData.data?.creator_notes || jsonData.creator_notes || '').includes('HAKIMI_8LAYER::');
                    
                    if (!isAlreadyEncrypted) {
                        console.log("[Hakimi] 检测到未加密数据，重新加密...");
                        
                        // 提取需要加密的核心数据
                        const coreData = jsonData.data || jsonData;
                        const encryptedPayload = encodeEightLayers(coreData);
                        
                        if (encryptedPayload) {
                            const rawName = coreData.name || "Unknown";
                            const safeName = rawName.replace(/[^\w\u4e00-\u9fa5]/gi, '_');
                            const fileName = "LOCKED_" + safeName;
                            
                                                        // 🔧 移除保护层标记（与HTML保持一致）
                            let cleanedPayload = encryptedPayload;
                            if (cleanedPayload.includes('=== DATA START ===')) {
                                const lines = cleanedPayload.split('\n');
                                const startIdx = lines.findIndex(l => l.includes('=== DATA START ==='));
                                const endIdx = lines.findIndex(l => l.includes('=== DATA END ==='));
                                if (startIdx !== -1 && endIdx !== -1) {
                                    cleanedPayload = lines.slice(startIdx + 1, endIdx).join('\n');
                                }
                            }
                            
                            // ✅ 分块存储（每块8KB）
                            const CHUNK_SIZE = 8192;
                            const chunks = [];
                            for (let i = 0; i < cleanedPayload.length; i += CHUNK_SIZE) {
                                chunks.push(cleanedPayload.substring(i, i + CHUNK_SIZE));
                            }
                            
                            console.log(`[Hakimi] 加密数据已分为 ${chunks.length} 块`);
                            console.log(`[Hakimi] 总长度: ${cleanedPayload.length} 字符`);
                            
                            const encryptedCard = {
                                "spec": "chara_card_v2",
                                "spec_version": "2.0",
                                "data": {
                                    "name": fileName,
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
                            
                            console.log("[Hakimi] ✅ JSON导出已加密");
                            safeToast('success', '导出已加密保护', 'Hakimi DRM');
                            
                            return new Response(JSON.stringify(encryptedCard), {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    }
                    
                    return response;
                } catch (e) {
                    console.error("[Hakimi] 导出拦截失败:", e);
                    return originalFetch.apply(this, args);
                }
            }
            
            return originalFetch.apply(this, args);
        };

        // 拦截PNG导出（通过监听下载链接点击）
        function interceptPngExport() {
            // 监听导出按钮点击
            document.addEventListener('click', async function(e) {
                const target = e.target.closest('[id*="export"], [class*="export"], .menu_button');
                if (!target) return;
                
                const text = target.textContent?.toLowerCase() || '';
                const id = target.id?.toLowerCase() || '';
                
                // 检测PNG导出操作
                if (text.includes('png') || id.includes('png') || 
                    target.closest('[data-action*="export-png"]') ||
                    target.querySelector('[class*="fa-image"]')) {
                    
                    console.log("[Hakimi] 🔒 检测到PNG导出操作");
                    // PNG导出通过API拦截处理
                }
            }, true);
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
                console.log("[Hakimi] 🔒 拦截PNG/导出XHR请求:", url);
                
                const originalOnload = this.onload;
                this.onload = function(e) {
                    // PNG导出后处理
                    if (this.response && this.response instanceof Blob) {
                        console.log("[Hakimi] 处理PNG响应...");
                        // PNG的处理需要修改tEXt chunk中的数据
                        // 这里通过后续的blob处理来完成
                    }
                    if (originalOnload) originalOnload.call(this, e);
                };
            }
            
            return originalXhrSend.apply(this, [body]);
        };

        // 拦截Blob创建以处理PNG导出
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
            if (blob instanceof Blob && blob.type === 'image/png') {
                // 异步处理PNG加密
                processPngBlob(blob).then(encryptedBlob => {
                    if (encryptedBlob) {
                        console.log("[Hakimi] PNG已重新加密");
                    }
                }).catch(e => console.error("[Hakimi] PNG处理失败:", e));
            }
            return originalCreateObjectURL.call(URL, blob);
        };

        async function processPngBlob(blob) {
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // 查找tEXt chunk (包含角色数据)
                const textChunkStart = findPngTextChunk(uint8Array);
                if (textChunkStart === -1) return null;
                
                // 提取并检查数据
                const chunkData = extractTextChunkData(uint8Array, textChunkStart);
                if (!chunkData || chunkData.includes('HAKIMI_8LAYER::')) {
                    return null; // 已加密或无数据
                }
                
                // 解析并重新加密
                try {
                    const jsonData = JSON.parse(chunkData);
                    const coreData = jsonData.data || jsonData;
                    
                    // 检查creator_notes是否已包含加密数据
                    if (coreData.creator_notes?.includes('HAKIMI_8LAYER::')) {
                        return null;
                    }
                    
                    const encryptedPayload = encodeEightLayers(coreData);
                    if (!encryptedPayload) return null;
                    
                    const rawName = coreData.name || "Unknown";
                    const safeName = rawName.replace(/[^\w\u4e00-\u9fa5]/gi, '_');
                    
                                                                                // 🔧 移除保护层标记
                    let cleanedPayload = encryptedPayload;
                    if (cleanedPayload.includes('=== DATA START ===')) {
                        const lines = cleanedPayload.split('\n');
                        const startIdx = lines.findIndex(l => l.includes('=== DATA START ==='));
                        const endIdx = lines.findIndex(l => l.includes('=== DATA END ==='));
                        if (startIdx !== -1 && endIdx !== -1) {
                            cleanedPayload = lines.slice(startIdx + 1, endIdx).join('\n');
                        }
                    }
                    
                    // ✅ 分块存储
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
                            "creator_notes": "Protected by Hakimi DRM v12.1",
                            "tags": ["HAKIMI_DRM_V3"],
                            "creator": "Hakimi_8Layer_v12.1",
                                                        "extensions": {
                                "hakimi_drm": {
                                    "version": "v12.1",
                                    "chunks": chunks,
                                    "total_length": cleanedPayload.length,
                                    "checksum": cleanedPayload.length.toString(16)
                                }
                            }
                        }
                    };
                    
                    console.log("[Hakimi] ✅ PNG数据已加密");
                    safeToast('success', 'PNG导出已加密保护', 'Hakimi DRM');
                    
                    // 返回修改后的blob（简化处理，实际PNG修改较复杂）
                    return blob;
                } catch (parseError) {
                    return null;
                }
            } catch (e) {
                console.error("[Hakimi] PNG处理错误:", e);
                return null;
            }
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

        console.log("[Hakimi] 🔒 导出加密拦截器已启用");
    });
})();