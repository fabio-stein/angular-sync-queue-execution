import { Subject, Observable } from 'rxjs';

let CurrentExecution: number = NaN;
let ExecutionQueue: number[] = [];
let OnComplete$: Subject<number> = new Subject();
let OnComplete: Observable<number> = OnComplete$.asObservable();


//TODO Queue Id Parameter
//allow multiple queues

async function WaitForEmptyQueue(executionId: number, timeout: number) {
    ExecutionQueue.push(executionId);
    return new Promise((res, rej) => {
        let timeout: any;
        let subscription = OnComplete.subscribe((e: number) => {
            if (e == executionId) {
                clearTimeout(timeout);
                res();
            }
        })
        timeout = setTimeout(() => {
            try {
                subscription.unsubscribe();
                rej("Execution queue timeout");
            } catch (e) { }
        }, timeout);
    });
}

function FinishExecution() {
    if (ExecutionQueue.length > 0) {
        CurrentExecution = ExecutionQueue[0];
        ExecutionQueue.shift();
        OnComplete$.next(CurrentExecution)
    } else {
        CurrentExecution = NaN;
    }
}

async function ExecutionHandler(instance: any, execution: any, timeout: number, ...args: any[]) {
    let executionId = Math.random();
    if (isNaN(CurrentExecution)) {
        CurrentExecution = executionId;
    } else {
        await WaitForEmptyQueue(executionId, timeout);
    }

    try {
        let result = await execution.apply(instance, args);
        return result;
    } catch (e) {
        throw e;
    } finally {
        FinishExecution();
    }
}

export function SyncQueueExecution(timeout = 30000) {
    return function InnerDecorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        let originalMethod = descriptor.value;
        //Here we put a handler before the method itself
        descriptor.value = async function (...args: any[]) {
            let result = await ExecutionHandler(this, originalMethod, timeout, args);
            return result;
        }
    }
}