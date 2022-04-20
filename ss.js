// script starter, do "run ss.js servername" eg. run ss.js neo-net

/*
TODO:
    - Implement logging for batching
    - Implement batching
*/
 
export async function main(ns) {
    ns.disableLog('ALL');
    if (ns.args[0] == null) {
        ns.print('ERROR: No server specified');
        ns.exit();
    }
 
    await Exploit(ns, ns.args[0]);
}
 
async function Exploit(ns, server) {
    while (true) {
        // Flag to know if we reached stability for batching
        var stable = false;
 
        // Security
        const minSec = await ns.getServerMinSecurityLevel(server);
        const sec = await ns.getServerSecurityLevel(server);
        const tsec = Math.ceil((sec - minSec) * 20);
 
        // Money
        var money = await ns.getServerMoneyAvailable(server);
        if (money <= 0) money = 1; // division by zero safety
        const maxMoney = await ns.getServerMaxMoney(server);
        const tmoney = Math.ceil(await ns.growthAnalyze(server, maxMoney / money));
 
        // Hacking
        const thack = Math.ceil(await ns.hackAnalyzeThreads(server, money));
 
        // Report
        ns.print('');
        ns.print(server);
        ns.print('Money    : ' + ns.nFormat(money, "$0.000a") + ' / ' + ns.nFormat(maxMoney, "$0.000a") + ' (' + (money / maxMoney * 100).toFixed(2) + '%)');
        ns.print('security : ' + (sec - minSec).toFixed(2));
        ns.print('weaken   : ' + ns.tFormat(await ns.getWeakenTime(server)) + ' (t=' + Math.ceil((sec - minSec) * 20) + ')');
        ns.print('grow     : ' + ns.tFormat(await ns.getGrowTime(server)) + ' (t=' + Math.ceil(await ns.growthAnalyze(server, maxMoney / money)) + ')');
        ns.print('hack     : ' + ns.tFormat(await ns.getHackTime(server)) + ' (t=' + Math.ceil(await ns.hackAnalyzeThreads(server, money)) + ')');
        ns.print('');
 
        var wait = 0;
 
        // Check if security is above minimum
        if (sec > minSec) {
            // We need to lower security
            ns.print('Security is over minimum, we need ' + tsec + ' threads to floor it');
            await RunScript(ns, 'weaken-once.js', server, tsec);
 
            wait = await ns.getWeakenTime(server) + 250;
            ns.print('Waiting for script completion (' + ns.tFormat(wait) + ')');
            await ns.sleep(wait);
        }
        else if (money < maxMoney) {
            // We need to grow the server
            ns.print('Money is under maximum, we need ' + tmoney + ' threads to max it');
            await RunScript(ns, 'grow-once.js', server, tmoney);
 
            wait = await ns.getGrowTime(server) + 250;
            ns.print('Waiting for script completion (' + ns.tFormat(wait) + ')');
            await ns.sleep(wait);
        }
        else {
            if (stable == false) {
                // We have reached floor security and full money
                // Time to start batching!
                stable = true;
            }
 
            // Server is ripe for hacking
            ns.print('Server is ripe for hacking, full hack would require ' + thack + ' threads');
            await RunScript(ns, 'hack-once.js', server, thack * 1.0); // only hack 100% of the money
 
            wait = await ns.getHackTime(server) + 250;
            ns.print('Waiting for script completion (' + ns.tFormat(wait) + ')');
            await ns.sleep(wait);
        }
    }
}
 
async function RunScript(ns, scriptName, target, threads) {
    // Find all servers
    var allServers = RecursiveScan(ns);
 
    // Sort by maximum memory
    allServers = allServers.sort(RamSort);
    function RamSort(a, b) {
        if (ns.getServerMaxRam(a) > ns.getServerMaxRam(b)) return -1;
        if (ns.getServerMaxRam(a) < ns.getServerMaxRam(b)) return 1;
        return 0;
    }
    function HomeSort(a, b) {
        if (a == 'home') return -1;
        if (b == 'home') return 1;
        return 0;
    }
 
    function CrusherSort(a, b) {
        if (a == 'home') return 1;
        if (b == 'home') return -1;
        return 0;
    }
 
    // Prioritize home or crushers depending
    if (scriptName == 'hack-once.js')
        allServers = allServers.sort(CrusherSort);
    else
        allServers = allServers.sort(HomeSort);
 
    // Find script RAM usage
    var ramPerThread = await ns.getScriptRam(scriptName);
 
    // Find usable servers
    var usableServers = allServers.filter(p => ns.hasRootAccess(p) && ns.getServerMaxRam(p) > 0);
 
    // Fired threads counter
    var fired = 0;
 
    for (const server of usableServers) {
        // Do not use home server for now
        //if (server == 'home')
        //  continue;
 
        // Determin how many threads we can run on target server for the given script
        var availableRam = await ns.getServerMaxRam(server) - await ns.getServerUsedRam(server);
        if (server == 'home') availableRam -= 512;
        var possibleThreads = Math.floor(availableRam / ramPerThread);
 
        // Check if server is already at max capacity
        if (possibleThreads <= 0)
            continue;
 
        // Lower thread count if we are over target
        if (possibleThreads > threads)
            possibleThreads = threads;
 
        // Copy script to the server
        if (server != 'home')
            await ns.scp(scriptName, server);
 
        // Fire the script with as many threads as possible
        await ns.print('Starting script ' + scriptName + ' on ' + server + ' with ' + possibleThreads + ' threads');
        await ns.exec(scriptName, server, possibleThreads, target);
 
        fired += possibleThreads;
 
        if (fired >= threads) break;
    }
}
 
function RecursiveScan(ns, root, found) {
    if (found == null) found = new Array();
    if (root == null) root = 'home';
    if (found.find(p => p == root) == undefined) {
        found.push(root);
        for (const server of ns.scan(root))
            if (found.find(p => p == server) == undefined)
                RecursiveScan(ns, server, found);
    }
    return found;
}
