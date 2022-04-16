export async function main(ns) {

    //the target that will be hacked
    var target = "neo-net";

    //how much the target has before hacking starts, should be from .7-.9
    var moneyThresh = ns.getServerMaxMoney(target) * 0.75;

    //max security the target has before weakening
    var securityThresh = ns.getServerMinSecurityLevel(target) + 5;

    while (true) {
        while (ns.getServerSecurityLevel(target) > securityThresh)
            await ns.weaken(target);

        while (ns.getServerMoneyAvailable(target) < moneyThresh)
            await ns.grow(target);

        await ns.hack(target);
    }
}
